const BADGE_COLOR = "#90EE90"
const BADGE_COUNTDOWN_COLOR = "#B81D13"

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
			for (let [key, { newValue }] of Object.entries(changes)) {
				this.config[key] = newValue

				if (key === "countdownEnabled") {
					if (newValue) {
						this.startCountdown()
					} else {
						clearInterval(this.countdownInterval)
					}
				} else if (
					key === "maxTabsEnabled" ||
					(key === "maxTabs" && this.config.maxTabsEnabled)
				) {
					this.updateBadge()
				}
			}
		})
	},

	startCountdown() {
		let secondsPast = 0

		this.countdownInterval = setInterval(() => {
			const timeRemaining = this.config.countdown - secondsPast

			if (secondsPast === this.config.countdown) {
				if (this.tabsCount === this.config.maxTabs && this.activeTabId) {
					this.removeTab(this.activeTabId)
				}

				this.updateBadge()
				clearInterval(this.countdownInterval)
			} else if (timeRemaining <= 10) {
				this.setBadgeColor(BADGE_COUNTDOWN_COLOR)
				this.setBadgeText(timeRemaining.toString())
			}
			secondsPast += 1
		}, 1000)
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
		this.setBadgeColor(BADGE_COLOR)
	},

	setBadgeText(text) {
		chrome.action.setBadgeText({ text })
	},

	setBadgeColor(color) {
		chrome.action.setBadgeBackgroundColor({ color })
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
