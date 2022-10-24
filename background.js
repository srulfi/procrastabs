const Procrastabs = {
	tabs: [],
	openTabs: undefined,
	config: {
		enabled: false,
		maxTabs: undefined,
	},

	async init() {
		this.setTabsListeners()
		this.setStorageSyncListener()

		await this.setOpenTabs()
		this.runSync()
	},

	setTabsListeners() {
		chrome.tabs.onCreated.addListener((tab) => {
			const totalOpenTabs = this.openTabs + 1

			if (this.config.enabled && totalOpenTabs > this.config.maxTabs) {
				chrome.tabs.remove(tab.id, () => {
					this.tabClosedByExtension = true
				})
			} else {
				this.openTabs = totalOpenTabs
				this.runSync()
			}
		})

		chrome.tabs.onRemoved.addListener((tab) => {
			if (this.tabClosedByExtension) {
				this.tabClosedByExtension = false
			} else {
				this.openTabs -= 1
				this.runSync()
			}
		})
	},

	setStorageSyncListener() {
		chrome.storage.onChanged.addListener((changes) => {
			const changesArray = Object.entries(changes)
			const [key, { newValue }] = changesArray[0]

			this.config[key] = newValue
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
