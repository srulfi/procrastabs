import defaults from "./defaults.js"

const ProcrastabsManager = {
	tabs: [],
	bypassSync: false,

	config: {
		badgeBaseColor: defaults.badge.baseColor,
		badgeCountdownColor: defaults.badge.countdownColor,
		badgeCountdownEnabled: defaults.badge.countdownEnabled,
		maxTabs: defaults.maxTabs.value,
		maxTabsEnabled: defaults.maxTabs.enabled,
		countdown: defaults.countdown.value,
		countdownEnabled: defaults.countdown.enabled,
		closeDuplicates: defaults.closeDuplicates,
		killAllMode: defaults.killAllMode,
	},

	async init() {
		const tabs = await this.queryTabs()
		const windowId = await this.getCurrentWindowId()
		const config = await this.getConfigFromStorage()

		const { tabs: storageTabs } = config
		const today = this.getStatsTodayKey()

		if (!config.maxTabs) {
			config.maxTabs = tabs.length
		} else if (config.countdownEnabled && tabs.length > config.maxTabs) {
			config.maxTabsEnabled = false
			config.countdownEnabled = false
		}

		if (!config.today) {
			config.today = today
		}

		if (!config[today]) {
			config[today] = {
				maxTabs: tabs.length,
			}
		}

		this.tabs = tabs.map((currentTab) => {
			if (storageTabs) {
				const storageTab = storageTabs.find((sTab) => sTab.id === currentTab.id)

				if (storageTab) {
					if (storageTab.activeAt) {
						// service worker reconnected OR extension was reinstalled
						storageTab.timeActive += Date.now() - storageTab.activeAt
					}

					storageTab.activeAt =
						currentTab.active && currentTab.windowId === windowId
							? Date.now()
							: null

					return {
						...currentTab,
						...storageTab,
					}
				}
			}

			return {
				...currentTab,
				createdAt: Date.now(),
				timeActive: 0,
			}
		})

		this.config = { ...this.config, ...config }

		console.log("tabs: ", this.tabs)
		console.log("config: ", this.config)

		await this.syncWithClient()

		this.updateBadge()
		this.setTabsListeners()
		this.setWindowsListeners()
		this.setStorageSyncListener()

		if (
			config.countdownEnabled &&
			(this.tabs.length === this.config.maxTabs ||
				(config.killAllMode && this.tabs.length < this.config.maxTabs))
		) {
			this.startCountdown()
			this.setBadgeCountdownColor()
			this.setBadgeCountdownInMinutes(this.config.countdown)
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

	async queryCurrentTab() {
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

	async getCurrentWindowId() {
		try {
			const { id } = await chrome.windows.getCurrent()
			return id
		} catch (e) {
			console.error(e)
		}
	},

	async getConfigFromStorage() {
		try {
			const config = await chrome.storage.sync.get()
			return config
		} catch (e) {
			console.error(e)
		}
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
						this.updateBadge()
						return
					}
				}

				if (this.config.countdownEnabled) {
					if (!this.config.killAllMode && this.hasTabsLeft()) {
						this.stopCountdown()
						this.updateBadge()
					} else if (!this.countdownOn) {
						this.startCountdown()
						this.setBadgeCountdownColor()
						this.setBadgeCountdownInMinutes(this.config.countdown)
					}
				} else {
					this.updateBadge()
				}

				this.syncTabsWithClient()
				this.syncStatsMaxTabs()
			}
		})

		chrome.tabs.onUpdated.addListener((tabId, updates) => {
			this.tabs = this.tabs.map((tab) => {
				if (tab.id === tabId) {
					if (updates.url && tab.url && updates.url !== tab.url) {
						const { host: tabHost, pathname: tabPathname } = new URL(tab.url)
						const { host: updatesHost, pathname: updatesPathname } = new URL(
							updates.url
						)
						const tabUrlWithoutParams = tabHost + tabPathname
						const updatesUrlWithoutParams = updatesHost + updatesPathname

						// only account for url change if host and pathname are different.
						// don't account for url change if search params are different.
						if (tabUrlWithoutParams !== updatesUrlWithoutParams) {
							tab.createdAt = Date.now()
							tab.activeAt = Date.now()
							tab.timeActive = 0
						}
					}

					return { ...tab, ...updates }
				}
				return tab
			})

			if (this.config.closeDuplicates) {
				const tab = this.tabs.find((tab) => tab.id === tabId)
				if (tab?.status === "complete") {
					const duplicateTabs = this.getDuplicateTabsOf(tab)

					if (duplicateTabs.length) {
						this.removeTabsById([duplicateTabs[0].id])
						this.syncTabsWithClient()
						this.updateBadge()
						return
					}
				}
			}

			this.syncTabsWithClient()
		})

		chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
			const { isWindowClosing, windowId } = removeInfo

			if (isWindowClosing) {
				this.tabs = this.tabs.filter(
					(tab) => tab.windowId !== windowId && tab.id !== tabId
				)
			} else {
				let removedTabIndex
				this.tabs = this.tabs.filter((tab) => {
					if (tab.id === tabId) {
						removedTabIndex = tab.index
						return false
					}
					return true
				})

				this.tabs = this.tabs.map((tab) => {
					if (tab.windowId === windowId && tab.index > removedTabIndex) {
						tab.index -= 1
					}
					return tab
				})
			}

			if (this.config.countdownEnabled) {
				if (this.config.killAllMode) {
					if (this.countdownOn) {
						this.syncTabsWithClient()
						return // prevent updating badge below
					} else {
						this.startCountdown()
					}
				} else if (this.hasTabsLeft()) {
					this.stopCountdown()
				}
			}

			if (!this.bypassSync) {
				this.syncTabsWithClient()
				this.updateBadge()
			}

			this.bypassSync = false
		})

		chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
			this.tabs = this.tabs.map((tab) => {
				if (tab.id === tabId) {
					// update windowId in case tab got activated after being detached from window
					tab.windowId = windowId
				}
				return tab
			})

			this.updateActivityOnTabChange(tabId)
			this.syncTabsWithClient()
		})

		/*
			onMoved behaviour considerations:
				- if the user moves the tab within the window, it will fire once per tab position shift.
				eg: a tab that is moved from position 1 to 3 will output
				{ ..., fromIndex: 1, toIndex: 2 }, { ..., fromIndex: 2, toIndex: 3 }
				- if the user attaches the tab from another window, it will fire only once.
				eg: a tab that is attached to the 3rd position of the window will output
				{ ..., fromIndex: 0, toIndex: 3 }
		*/
		chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
			const { windowId, fromIndex, toIndex } = moveInfo

			this.tabs = this.tabs.map((tab) => {
				if (tab.id === tabId) {
					tab.index = toIndex
				} else if (tab.windowId === windowId) {
					if (toIndex - fromIndex > 1) {
						if (tab.index <= toIndex) {
							tab.index -= 1
						}
					} else if (tab.index === toIndex) {
						tab.index = fromIndex
					}
				}
				return tab
			})

			this.syncTabsWithClient()
		})

		chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
			const { newPosition, newWindowId } = attachInfo

			this.tabs = this.tabs.map((tab) => {
				if (tab.id === tabId) {
					tab.windowId = newWindowId
					tab.index = newPosition
				} else if (tab.windowId === newWindowId && tab.index >= newPosition) {
					tab.index += 1
				}
				return tab
			})

			this.syncTabsWithClient()
		})

		chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
			const { oldPosition, oldWindowId } = detachInfo

			this.tabs = this.tabs.map((tab) => {
				if (tab.windowId === oldWindowId && tab.index > oldPosition) {
					tab.index -= 1
				}
				return tab
			})

			this.syncTabsWithClient()
		})
	},

	setWindowsListeners() {
		chrome.windows.onFocusChanged.addListener(async (windowId) => {
			if (windowId === -1) {
				// All Chrome windows have lost focus
				this.tabs = this.tabs.map((tab) => {
					if (tab.activeAt) {
						tab.timeActive += Date.now() - tab.activeAt
						tab.activeAt = null
					}
					return tab
				})
				this.stopCountdown()
				this.updateBadge()
			} else {
				const currentTab = await this.queryCurrentTab()
				if (currentTab && currentTab.windowId === windowId) {
					this.updateActivityOnTabChange(currentTab.id)
				}

				if (
					this.config.countdownEnabled &&
					!this.hasTabsLeft() &&
					!this.countdownOn
				) {
					this.startCountdown()
					this.updateBadge()
				}
			}

			this.syncTabsWithClient()
		})
	},

	setStorageSyncListener() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				this.config[key] = newValue
				if (
					(key === "maxTabs" && !this.config.killAllMode) ||
					key === "maxTabsEnabled" ||
					key === "countdown" ||
					key === "countdownEnabled" ||
					(key === "killAllMode" && !newValue && this.hasTabsLeft())
				) {
					this.stopCountdown()
				}

				if (key === "tabs") {
					return
				}

				if (key === "closeDuplicates" && newValue) {
					this.closeDuplicateTabs()
					return
				}
			}

			if (this.config.countdownEnabled) {
				if (
					(!this.hasTabsLeft() || this.config.killAllMode) &&
					!this.countdownOn
				) {
					this.startCountdown()
					this.setBadgeCountdownColor()
					this.setBadgeCountdownInMinutes(this.config.countdown)
				} else if (!this.config.killAllMode && this.hasTabsLeft()) {
					this.updateBadge()
				}
			} else {
				this.updateBadge()
			}
		})
	},

	updateActivityOnTabChange(tabId) {
		this.tabs = this.tabs.map((tab) => {
			if (tab.id === tabId && !tab.activeAt) {
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

	async activateCurrentTab() {
		const currentTab = await this.queryCurrentTab()

		if (currentTab) {
			this.tabs = this.tabs.map((tab) => {
				if (tab.id === currentTab.id) {
					tab.activeAt = Date.now()
				}
				return tab
			})

			this.syncTabsWithClient()
		}
	},

	deactivateCurrentTab() {
		this.tabs = this.tabs.map((tab) => {
			if (tab.activeAt) {
				tab.timeActive += Date.now() - tab.activeAt
				tab.activeAt = null
			}
			return tab
		})

		this.syncTabsWithClient()
	},

	resetActivity() {
		this.tabs = this.tabs.map((tab) => ({
			...tab,
			createdAt: Date.now(),
			activeAt: null,
			timeActive: 0,
		}))

		this.syncTabsWithClient()
	},

	startCountdown() {
		let countdownInSeconds = this.config.countdown * 60
		let secondsPast = 0

		this.countdownOn = true

		this.countdownInterval = setInterval(async () => {
			const minutesRemaining = Math.ceil(
				this.config.countdown - secondsPast / 60
			)
			const secondsRemaining = countdownInSeconds - secondsPast

			if (secondsPast === countdownInSeconds) {
				if (!this.hasTabsLeft() || this.config.killAllMode) {
					const currentTab = await this.queryCurrentTab()
					if (currentTab) {
						this.removeTabsById([currentTab.id])
					} else {
						this.stopCountdown()
						this.updateBadge()
					}
				}
			} else if (this.config.badgeCountdownEnabled) {
				this.setBadgeCountdownColor()
				if (secondsRemaining < 60) {
					this.setBadgeCountdownInSeconds(secondsRemaining)
				} else {
					this.setBadgeCountdownInMinutes(minutesRemaining)
				}
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

	highlightTab(index, windowId) {
		chrome.tabs.highlight({ tabs: index, windowId })
		chrome.windows.update(windowId, { focused: true })
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

	setBadgeCountdownColor() {
		this.setBadgeColor(this.config.badgeCountdownColor)
	},

	setBadgeCountdownInMinutes(minutes) {
		this.setBadgeText(`${minutes.toString()}m`)
	},

	setBadgeCountdownInSeconds(seconds) {
		this.setBadgeText(seconds.toString())
	},

	setBadgeText(text) {
		chrome.action.setBadgeText({ text })
	},

	setBadgeColor(color) {
		chrome.action.setBadgeBackgroundColor({ color })
	},

	removeExtraPropsFromTabs() {
		return this.tabs.map((tab) => ({
			id: tab.id,
			windowId: tab.windowId,
			index: tab.index,
			title: tab.title,
			url: tab.url,
			createdAt: tab.createdAt,
			activeAt: tab.activeAt,
			timeActive: tab.timeActive,
		}))
	},

	getStatsTodayKey() {
		const year = new Date().getFullYear()
		const month = new Date().getMonth() + 1
		const day = new Date().getDate()

		return `${year}-${month}-${day}`
	},

	async getStatsFromStorage(dateKey) {
		try {
			const stats = await chrome.storage.sync.get(dateKey)
			return stats?.[dateKey] || {}
		} catch (e) {
			console.error(e)
		}
	},

	async syncTodayStats(todayKey, todayStats) {
		try {
			await chrome.storage.sync.set({
				today: todayKey,
				[todayKey]: todayStats,
			})
		} catch (e) {
			console.error(e)
		}
	},

	async syncStatsMaxTabs() {
		const currentTabsCount = this.tabs.length
		const todayKey = this.getStatsTodayKey()
		const todayStats = await this.getStatsFromStorage(todayKey)

		if (!todayStats.maxTabs || todayStats.maxTabs < currentTabsCount) {
			todayStats.maxTabs = currentTabsCount
			await this.syncTodayStats(todayKey, todayStats)
		}
	},

	async syncTabsWithClient() {
		try {
			const tabs = this.removeExtraPropsFromTabs()
			await chrome.storage.sync.set({ tabs })
		} catch (e) {
			console.error(e)
		}
	},

	async syncWithClient() {
		try {
			const tabs = this.removeExtraPropsFromTabs()
			await chrome.storage.sync.set({
				tabs,
				maxTabs: this.config.maxTabs,
				maxTabsEnabled: this.config.maxTabsEnabled,
				countdown: this.config.countdown,
				countdownEnabled: this.config.countdownEnabled,
				closeDuplicates: this.config.closeDuplicates,
				killAllMode: this.config.killAllMode,
				today: this.config.today,
				[this.config.today]: this.config[this.config.today],
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

chrome.runtime.onMessage.addListener((req) => {
	if (req.id === "tracker-tab-click") {
		ProcrastabsManager.highlightTab(req.index, req.windowId)
	} else if (req.id === "tracker-reset") {
		ProcrastabsManager.resetActivity()
	}
})

/*
	Start of workaround to "persist" service-worker as Chrome terminates all connections after 5 minutes (295e3).
	https://stackoverflow.com/a/66618269
*/
let lifeline

chrome.runtime.onConnect.addListener((port) => {
	if (port.name === "keep-alive") {
		lifeline = port
		setTimeout(forceKeepAlive, 295e3)
		port.onDisconnect.addListener(forceKeepAlive)
	} else if (port.name === "popup") {
		lifeline = port
		setTimeout(forceKeepAlive, 295e3)
		ProcrastabsManager.deactivateCurrentTab()
		port.onDisconnect.addListener(() => {
			ProcrastabsManager.activateCurrentTab()
			forceKeepAlive()
		})
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
