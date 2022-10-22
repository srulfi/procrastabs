const Procrastabs = {
	tabs: [],
	openTabs: 0,
	enabled: false,

	async init() {
		this.setTabsListeners()
		this.setStorageSyncListener()

		await this.setOpenTabs()
		this.syncStorage()
	},

	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			this.openTabs += 1
			this.runSync()
		})
		chrome.tabs.onRemoved.addListener((tab) => {
			this.openTabs -= 1
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

	async setOpenTabs() {
		this.tabs = await chrome.tabs.query({})
		this.openTabs = this.tabs.length
	},

	updateBadge() {
		chrome.action.setBadgeText({ text: this.openTabs.toString() })
		chrome.action.setBadgeBackgroundColor({ color: "#9688F1" })
	},

	syncStorage() {
		chrome.storage.sync.set({ openTabs: this.openTabs })
	},

	runSync() {
		this.updateBadge()
		this.syncStorage()
	},
}

Procrastabs.init()
