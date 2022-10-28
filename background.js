import defaults from "./defaults.js"

const ProcrastabsManager = {
	tabs: [],
	tabsCount: 0,
	activeTabId: undefined,
	activeWindowId: undefined,
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
	},

	async init() {
		this.tabs = await this.queryTabs()
		this.tabsCount = this.tabs.length

		const config = await this.getConfigFromStorage()

		if (!config.maxTabs) {
			config.maxTabs = this.tabsCount
		} else if (config.countdownEnabled && this.tabsCount > config.maxTabs) {
			config.maxTabsEnabled = false
			config.countdownEnabled = false
		}

		this.config = { ...this.config, ...config }

		this.setTabsListeners()
		this.setStorageSyncListener()

		await this.syncWithClient()

		if (config.countdownEnabled && this.tabsCount === config.maxTabs) {
			this.startCountdown()
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

	async getConfigFromStorage() {
		try {
			const config = await chrome.storage.sync.get([
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
			])
			return config
		} catch (e) {
			console.error(e)
		}
	},

	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			this.tabsCount += 1

			if (this.config.maxTabsEnabled && this.tabsCount > this.config.maxTabs) {
				this.bypassSync = true
				this.removeTab(tab.id)
			} else {
				this.syncTabsWithClient()
			}

			if (
				this.config.maxTabsEnabled &&
				this.config.countdownEnabled &&
				this.hasMaxOpenTabs()
			) {
				this.startCountdown()
			}
		})

		chrome.tabs.onRemoved.addListener((tab) => {
			this.tabsCount -= 1

			if (!this.bypassSync) {
				this.syncTabsWithClient()
			}

			this.bypassSync = false
		})

		chrome.tabs.onActivated.addListener((activeInfo) => {
			const { tabId, windowId } = activeInfo

			this.activeTabId = tabId
			this.windowTabId = windowId
		})
	},

	setStorageSyncListener() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				this.config[key] = newValue

				switch (key) {
					case "maxTabs":
						if (this.config.countdownEnabled && this.hasMaxOpenTabs()) {
							this.startCountdown()
						} else if (this.countdownOn) {
							this.stopCountdown()
						} else {
							this.updateBadge()
						}
						break

					case "maxTabsEnabled":
						this.updateBadge()
						break

					case "countdown":
						if (this.config.countdownEnabled && this.hasMaxOpenTabs()) {
							this.stopCountdown()
							this.startCountdown()
						}
						break

					case "countdownEnabled":
						if (newValue) {
							if (this.hasMaxOpenTabs()) {
								this.startCountdown()
							}
						} else if (this.countdownOn) {
							this.stopCountdown()
						}
						break

					default:
						break
				}
			}
		})
	},

	startCountdown() {
		let countdownInSeconds = this.config.countdown * 60
		let secondsPast = 0

		this.countdownOn = true
		this.countdownInterval = setInterval(() => {
			const timeRemaining = countdownInSeconds - secondsPast

			if (secondsPast === countdownInSeconds) {
				if (this.hasMaxOpenTabs() && this.activeTabId) {
					this.removeTab(this.activeTabId)
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
		this.updateBadge()
	},

	removeTab(tabId) {
		chrome.tabs.remove(tabId)
	},

	updateBadge() {
		const tabsRemaining = this.config.maxTabs - this.tabsCount
		const tabsRemainingText = tabsRemaining === 0 ? "0" : `-${tabsRemaining}`
		const text = this.config.maxTabsEnabled
			? tabsRemainingText
			: this.tabsCount.toString()

		this.setBadgeText(text)
		this.setBadgeColor(this.config.badgeBaseColor)
	},

	setBadgeText(text) {
		chrome.action.setBadgeText({ text })
	},

	setBadgeColor(color) {
		chrome.action.setBadgeBackgroundColor({ color })
	},

	async syncTabsWithClient() {
		try {
			await chrome.storage.sync.set({ tabsCount: this.tabsCount })
			this.updateBadge()
		} catch (e) {
			console.error(e)
		}
	},

	async syncWithClient() {
		try {
			await chrome.storage.sync.set({
				tabsCount: this.tabsCount,
				maxTabs: this.config.maxTabs,
				maxTabsEnabled: this.config.maxTabsEnabled,
				countdown: this.config.countdown,
				countdownEnabled: this.config.countdownEnabled,
			})
			this.updateBadge()
		} catch (e) {
			console.error(e)
		}
	},

	hasMaxOpenTabs() {
		return this.tabsCount === this.config.maxTabs
	},
}

ProcrastabsManager.init()
