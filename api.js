const TabsPoli = {
	tabs: [],
	tabsCount: 0,
	async init() {
		this.setListeners()
		await this.getAllTabs()
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
	async getAllTabs() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
	},
}

TabsPoli.init()
