const BADGE_COLOR = "#90EE90"

chrome.runtime.onInstalled.addListener(() => Procrastabs.init())

const Procrastabs = {
	tabs: [],
	tabsCount: 0,
	activeTabId: undefined,
	activeWindowId: undefined,
	bypassSync: false,

	config: {
		maxTabs: undefined,
		maxTabsEnabled: false,
		countdown: undefined,
		countdownEnabled: false,
	},

	async init() {
		await this.setTabs()
		await this.setPersistedConfig()

		this.setTabsListeners()
		this.setStorageSyncListener()
		this.updateBadge()
	},

	async setTabs() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
	},

	async setPersistedConfig() {
		const config = await chrome.storage.sync.get([
			"maxTabs",
			"maxTabsEnabled",
			"countdown",
			"countdownEnabled",
		])

		this.config = config
		this.config.tabsCount = this.tabsCount

		await chrome.storage.sync.set(config)
	},

	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			this.tabsCount += 1

			if (this.config.maxTabsEnabled && this.tabsCount > this.config.maxTabs) {
				this.bypassSync = true
				this.removeTab(tab.id)
			} else {
				this.runSync()
			}

			if (
				this.config.maxTabsEnabled &&
				this.config.countdownEnabled &&
				this.tabsCount === this.config.maxTabs
			) {
				this.startCountdown()
			}
		})

		chrome.tabs.onRemoved.addListener((tab) => {
			this.tabsCount -= 1

			if (!this.bypassSync) {
				this.runSync()
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
			const changesArray = Object.entries(changes)
			const [key, { newValue }] = changesArray[0]

			this.config[key] = newValue

			if (key === "countdownEnabled") {
				if (newValue) {
					this.startCountdown()
				} else {
					clearInterval(this.countdownInterval)
				}
			} else if (key === "maxTabsEnabled") {
				this.updateBadge()
			}
		})
	},

	startCountdown() {
		let secondsPast = 0

		this.countdownInterval = setInterval(() => {
			if (++secondsPast === this.config.countdown) {
				if (this.tabsCount === this.config.maxTabs && this.activeTabId) {
					this.removeTab(this.activeTabId)
				}
				clearInterval(this.countdownInterval)
			}
		}, 1000)
	},

	removeTab(tabId) {
		chrome.tabs.remove(tabId)
	},

	updateBadge() {
		const color = BADGE_COLOR
		const tabsRemaining = this.config.maxTabs - this.tabsCount
		const tabsRemainingText = tabsRemaining === 0 ? "0" : `-${tabsRemaining}`
		const text = this.config.maxTabsEnabled
			? tabsRemainingText
			: this.tabsCount.toString()

		chrome.action.setBadgeBackgroundColor({ color })
		chrome.action.setBadgeText({ text })
	},

	syncStorage() {
		chrome.storage.sync.set({ tabsCount: this.tabsCount })
	},

	runSync() {
		this.updateBadge()
		this.syncStorage()
	},
}
