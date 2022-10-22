const TabsPoli = {
	tabs: [],
	tabsCount: 0,
	enabled: false,
	async init() {
		this.setTabsListeners()
		this.setStorageSyncListener()

		await this.setTabsCount()
		this.syncStorage()
	},
	badge: {
		setText(text) {
			chrome.action.setBadgeText({ text })
		},
		setBackgroundColor(color) {
			chrome.action.setBadgeBackgroundColor({ color })
		},
	},
	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			this.tabsCount += 1
			this.runSync()
		})
		chrome.tabs.onRemoved.addListener((tab) => {
			this.tabsCount -= 1
			this.runSync()
		})
	},
	setStorageSyncListener() {
		chrome.storage.onChanged.addListener((changes) => {
			const changesArray = Object.entries(changes)
			const [key, { newValue }] = changesArray[0]

			if (key === "enabled") {
				this.enabled = newValue
			}
		})
	},
	runSync() {
		this.updateBadge()
		this.syncStorage()
	},
	updateBadge() {
		this.badge.setText(this.tabsCount.toString())
		this.badge.setBackgroundColor("#9688F1")
	},
	async setTabsCount() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
	},
	syncStorage() {
		const openTabs = this.tabsCount
		chrome.storage.sync.set({ openTabs })
	},
}

TabsPoli.init()
