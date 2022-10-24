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

		this.setTabsListeners()
		this.setStorageSyncListener()
		this.runSync()
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
			}
		})
	},

	async setTabs() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
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
		chrome.action.setBadgeText({ text: this.tabsCount.toString() })
		chrome.action.setBadgeBackgroundColor({ color: "#9688F1" })
	},

	syncStorage() {
		chrome.storage.sync.set({ tabsCount: this.tabsCount })
	},

	runSync() {
		this.updateBadge()
		this.syncStorage()
	},
}

Procrastabs.init()
