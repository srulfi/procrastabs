const BADGE_COLOR = "#90EE90"
const BADGE_COUNTDOWN_COLOR = "#B81D13"
const BADGE_COUNTDOWN_SECONDS = 60

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
		await this.getPersistedConfig()

		this.setTabsListeners()
		this.setStorageSyncListener()
		this.runSync()
	},

	async setTabs() {
		this.tabs = await chrome.tabs.query({})
		this.tabsCount = this.tabs.length
	},

	async getPersistedConfig() {
		const config = await chrome.storage.sync.get([
			"maxTabs",
			"maxTabsEnabled",
			"countdown",
			"countdownEnabled",
		])

		if (config.countdownEnabled) {
			if (this.tabsCount === config.maxTabs) {
				this.startCountdown()
			} else if (this.tabsCount > config.maxTabs) {
				config.maxTabsEnabled = false
				config.countdownEnabled = false
			}
		}

		this.config = config
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
				this.hasMaxOpenTabs()
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
				console.log(key, ": ", newValue)
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
		this.countdownOn = true

		let secondsPast = 0
		this.countdownInterval = setInterval(() => {
			const timeRemaining = this.config.countdown - secondsPast

			if (secondsPast === this.config.countdown) {
				if (this.hasMaxOpenTabs() && this.activeTabId) {
					this.removeTab(this.activeTabId)
				}

				this.stopCountdown()
				this.updateBadge()
			} else if (timeRemaining < BADGE_COUNTDOWN_SECONDS) {
				this.setBadgeColor(BADGE_COUNTDOWN_COLOR)
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

	hasMaxOpenTabs() {
		return this.tabsCount === this.config.maxTabs
	},
}

Procrastabs.init()
