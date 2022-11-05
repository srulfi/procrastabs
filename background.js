import defaults from "./defaults.js"

const ProcrastabsManager = {
	tabs: [],
	bypassSync: false,

	config: {
		badgeBaseColor: defaults.badge.baseColor,
		badgeCountdownColor: defaults.badge.countdownColor,
		badgeCountdownSeconds: defaults.badge.countdownSeconds,
		badgeCountdownEnabled: defaults.badge.countdownEnabled,
		maxTabs: defaults.maxTabs.value,
		maxTabsEnabled: defaults.maxTabs.enabled,
		countdown: defaults.countdown.value,
		countdownEnabled: defaults.countdown.enabled,
		closeDuplicates: defaults.closeDuplicates,
	},

	async init() {
		const tabs = await this.queryTabs()
		const config = await this.getConfigFromStorage()

		if (!config.maxTabs) {
			config.maxTabs = tabs.length
		} else if (config.countdownEnabled && tabs.length > config.maxTabs) {
			config.maxTabsEnabled = false
			config.countdownEnabled = false
		}

		this.tabs = tabs
		this.config = { ...this.config, ...config }
		console.log("config: ", this.config)

		this.registerExistingTabs()
		this.setTabsListeners()
		this.setWindowsListeners()
		this.setStorageSyncListener()

		await this.syncWithClient()

		if (config.countdownEnabled && this.tabs.length === this.config.maxTabs) {
			this.startCountdown()
			this.updateBadge()
		}
	},

	async queryTabs() {
		try {
			const tabs = await chrome.tabs.query({})
			return tabs
		} catch (e) {
			throw new Error(e.message)
		}
	},

	async queryActiveTab() {
		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				lastFocusedWindow: true,
			})
			return tab
		} catch (e) {
			console.error(e)
		}
	},

	async getConfigFromStorage() {
		try {
			const config = await chrome.storage.sync.get([
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
				"closeDuplicates",
			])
			return config
		} catch (e) {
			console.error(e)
		}
	},

	async registerExistingTabs() {
		const currentTab = await this.queryActiveTab()
		const { id, windowId } = currentTab

		this.tabs = this.tabs.map((tab) => {
			if (tab.id === id && tab.windowId === windowId) {
				tab.activeAt = Date.now()
			}

			return {
				...tab,
				createdAt: Date.now(),
				timeActive: 0,
			}
		})
	},

	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			const newTab = {
				...tab,
				createdAt: Date.now(),
				timeActive: 0,
			}

			this.tabs.push(newTab)

			if (
				this.config.maxTabsEnabled &&
				this.tabs.length > this.config.maxTabs
			) {
				this.removeTabsById([newTab.id])
				this.bypassSync = true
			} else {
				if (this.config.closeDuplicates) {
					const duplicateTabs = this.getDuplicateTabsOf(newTab)

					if (duplicateTabs.length) {
						this.removeTabsById(duplicateTabs.map((duplicate) => duplicate.id))
						this.syncTabsWithClient()
						return
					}
				}

				if (this.config.countdownEnabled && !this.hasTabsLeft()) {
					this.startCountdown()
				}

				this.syncTabsWithClient()
			}
		})

		chrome.tabs.onUpdated.addListener((tabId, updates) => {
			this.tabs = this.tabs.map((tab) => {
				if (tab.id === tabId) {
					if (updates.status === "complete") {
						tab.activeAt = Date.now()
					}
					return { ...tab, ...updates }
				}
				return tab
			})

			this.syncTabsWithClient()
		})

		chrome.tabs.onRemoved.addListener((tabId) => {
			this.tabs = this.tabs.filter((stackTab) => stackTab.id !== tabId)

			if (
				this.config.countdownEnabled &&
				this.hasTabsLeft() &&
				this.countdownOn
			) {
				this.stopCountdown()
			}

			if (!this.bypassSync) {
				this.syncTabsWithClient()
			}

			this.bypassSync = false
		})

		chrome.tabs.onActivated.addListener(async (activeInfo) => {
			const { tabId } = activeInfo

			this.updateTimestampsOnTabChange(tabId)
			this.syncTabsWithClient()
		})
	},

	setWindowsListeners() {
		chrome.windows.onFocusChanged.addListener(async (windowId) => {
			if (windowId === -1) {
				// All Chrome Windows have lost focus
				this.tabs = this.tabs.map((tab) => {
					if (tab.activeAt) {
						tab.timeActive += Date.now() - tab.activeAt
						tab.activeAt = null
					}
					return tab
				})
			} else {
				const { id } = await this.queryActiveTab()
				this.updateTimestampsOnTabChange(id)
			}

			this.syncTabsWithClient()
		})
	},

	setStorageSyncListener() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				this.config[key] = newValue

				switch (key) {
					case "maxTabs":
						if (this.config.countdownEnabled && !this.hasTabsLeft()) {
							this.startCountdown()
						} else if (this.countdownOn) {
							this.stopCountdown()
						}
						this.updateBadge()
						break

					case "maxTabsEnabled":
						this.updateBadge()
						break

					case "countdown":
						if (this.config.countdownEnabled && !this.hasTabsLeft()) {
							this.stopCountdown()
							this.startCountdown()
							this.updateBadge()
						}
						break

					case "countdownEnabled":
						if (newValue && !this.hasTabsLeft()) {
							this.startCountdown()
							this.updateBadge()
						} else if (!newValue && this.countdownOn) {
							this.stopCountdown()
							this.updateBadge()
						}
						break

					case "closeDuplicates":
						if (this.config.closeDuplicates && newValue) {
							this.closeDuplicateTabs()
							break
						}

					default:
						break
				}
			}
		})
	},

	updateTimestampsOnTabChange(tabId) {
		this.tabs = this.tabs.map((tab) => {
			if (tab.id === tabId && !tab.activeAt && tab.url) {
				// current active tab
				tab.activeAt = Date.now()
			} else if (tab.id !== tabId && tab.activeAt) {
				// previous active tab
				tab.timeActive += Date.now() - tab.activeAt
				tab.activeAt = null
			}
			return tab
		})
	},

	startCountdown() {
		let countdownInSeconds = this.config.countdown * 60
		let secondsPast = 0

		this.countdownOn = true

		this.countdownInterval = setInterval(async () => {
			const timeRemaining = countdownInSeconds - secondsPast

			if (secondsPast === countdownInSeconds) {
				if (!this.hasTabsLeft()) {
					const { id } = await this.queryActiveTab()
					this.removeTabsById([id])
				}

				this.stopCountdown()
				this.updateBadge()
			} else if (
				this.config.badgeCountdownEnabled &&
				timeRemaining < this.config.badgeCountdownSeconds
			) {
				this.setBadgeColor(this.config.badgeCountdownColor)
				this.setBadgeText(timeRemaining.toString())
			}
			secondsPast += 1
		}, 1000)
	},

	stopCountdown() {
		clearInterval(this.countdownInterval)
		this.countdownOn = false
	},

	removeTabsById(tabIds) {
		chrome.tabs.remove(tabIds)
	},

	updateBadge() {
		const tabsRemaining = this.config.maxTabs - this.tabs.length
		const tabsRemainingText = tabsRemaining === 0 ? "0" : `-${tabsRemaining}`
		const text = this.config.maxTabsEnabled
			? tabsRemainingText
			: this.tabs.length.toString()

		this.setBadgeText(text)
		this.setBadgeColor(this.config.badgeBaseColor)
	},

	setBadgeText(text) {
		chrome.action.setBadgeText({ text })
	},

	setBadgeColor(color) {
		chrome.action.setBadgeBackgroundColor({ color })
	},

	removeExtraPropsFromTabs() {
		this.tabs = this.tabs.map((tab) => ({
			id: tab.id,
			windowId: tab.windowId,
			title: tab.title,
			url: tab.url,
			createdAt: tab.createdAt,
			activeAt: tab.activeAt,
			timeActive: tab.timeActive,
		}))
	},

	async syncTabsWithClient() {
		try {
			this.removeExtraPropsFromTabs()
			await chrome.storage.sync.set({ tabs: this.tabs })
			this.updateBadge()
		} catch (e) {
			console.error(e)
		}
	},

	async syncWithClient() {
		try {
			this.removeExtraPropsFromTabs()
			await chrome.storage.sync.set({
				tabs: this.tabs,
				maxTabs: this.config.maxTabs,
				maxTabsEnabled: this.config.maxTabsEnabled,
				countdown: this.config.countdown,
				countdownEnabled: this.config.countdownEnabled,
				closeDuplicates: this.config.closeDuplicates,
			})
			this.updateBadge()
		} catch (e) {
			console.error(e)
		}
	},

	hasTabsLeft() {
		return this.tabs.length < this.config.maxTabs
	},

	getDuplicateTabsOf(tab) {
		const duplicateTabs = this.tabs.filter((stackTab) => {
			if (
				(!tab || (tab && stackTab.id !== tab.id)) &&
				(stackTab.url === tab.url ||
					(!tab.url && stackTab.url === "chrome://newtab/"))
			) {
				return stackTab
			}
		})

		return duplicateTabs
	},

	closeDuplicateTabs() {
		const uniqueTabs = []
		const duplicateTabs = []

		this.tabs.forEach((stackTab) => {
			if (uniqueTabs.find((uniqueTab) => uniqueTab.url === stackTab.url)) {
				duplicateTabs.push(stackTab)
			} else {
				uniqueTabs.push(stackTab)
			}
		})

		if (duplicateTabs.length) {
			this.removeTabsById(duplicateTabs.map((duplicate) => duplicate.id))
		}
	},
}

ProcrastabsManager.init()

/*
	Start of workaround to "persist" service-worker as Chrome terminates all connections after 5 minutes.
	https://stackoverflow.com/a/66618269
*/
let lifeline

chrome.runtime.onConnect.addListener((port) => {
	if (port.name === "keep-alive") {
		lifeline = port
		setTimeout(forceKeepAlive, 295e3) // 5 minutes minus 5 seconds
		port.onDisconnect.addListener(forceKeepAlive)
	}
})

function forceKeepAlive() {
	lifeline?.disconnect()
	lifeline = null
	keepAlive()
}

async function keepAlive() {
	if (lifeline) return

	for (const tab of await chrome.tabs.query({ url: "*://*/*" })) {
		try {
			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: () => chrome.runtime.connect({ name: "keep-alive" }),
			})
			chrome.tabs.onUpdated.removeListener(retryOnTabUpdate)
			return
		} catch (e) {}
	}

	chrome.tabs.onUpdated.addListener(retryOnTabUpdate)
}

async function retryOnTabUpdate(tabId, info, tab) {
	if (info.url && /^(file|https?):/.test(info.url)) {
		keepAlive()
	}
}

keepAlive()
/* End of workaround */
