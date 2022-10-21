const DEFAULT_MAX_TABS = 10

const TabsPoli = {
	tabs: [],
	tabsCount: 0,
	async init() {
		this.setListeners()

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
	setListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			this.tabsCount += 1
			this.updateBadge()
		})
		chrome.tabs.onRemoved.addListener((tab) => {
			this.tabsCount -= 1
			this.updateBadge()
		})
	},
	updateBadge() {
		this.badge.setText(this.tabsCount.toString())
		this.badge.setBackgroundColor("9688F1")
	},
	async setTabsCount() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
	},
	syncStorage() {
		const tabs = this.tabsCount || DEFAULT_MAX_TABS
		chrome.storage.sync.set({ tabs }, () => {
			console.log("chrome storage synced with tabs: ", tabs)
		})
	},
}

TabsPoli.init()
