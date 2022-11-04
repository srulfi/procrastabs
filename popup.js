const milliToMin = (milliseconds) => Math.floor(milliseconds / 1000 / 60)

const Popup = {
	$tabsTrackerTable: document.querySelector("#tabs-tracker"),
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$closeDuplicatesSwitch: document.querySelector("#duplicates-switch"),
	$message: document.querySelector("#message"),

	async init() {
		const config = await this.getConfigFromStorage()

		this.tabs = config.tabs
		this.$maxTabsInput.value = config.maxTabs
		this.$maxTabsSwitch.checked = config.maxTabsEnabled
		this.$countdownInput.value = config.countdown
		this.$countdownSwitch.checked = config.countdownEnabled
		this.$closeDuplicatesSwitch.checked = config.closeDuplicates

		this.setEventListeners()
		this.setStorageListeners()
		this.populateTracker()
		this.setTrackerInterval()
	},

	async getConfigFromStorage() {
		try {
			const config = chrome.storage.sync.get([
				"tabs",
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
				"closeDuplicates",
			])
			return config
		} catch (e) {
			this.displayErrorMessage(e)
		}
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", () => {
			if (this.hasExtraTabs()) {
				this.setStorageItems({ maxTabsEnabled: false, countdownEnabled: false })
				this.disableMaxTabs()
				this.disableCountdown()
			}

			this.setStorageItems({ maxTabs: parseInt(this.$maxTabsInput.value) })
			this.resetMessage()
		})

		this.$maxTabsSwitch.addEventListener("change", () => {
			if (this.$maxTabsSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.setStorageItems({ maxTabsEnabled: false })
					this.disableMaxTabs()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({ maxTabsEnabled: true })
				}
			} else {
				this.setStorageItems({ maxTabsEnabled: false, countdownEnabled: false })
				this.disableCountdown()
				this.resetMessage()
			}
		})

		this.$countdownInput.addEventListener("change", () => {
			this.setStorageItems({ countdown: Number(this.$countdownInput.value) })
			this.resetMessage()
		})

		this.$countdownSwitch.addEventListener("change", () => {
			if (this.$countdownSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableCountdown()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({ maxTabsEnabled: true, countdownEnabled: true })
					this.enableMaxTabs()
				}
			} else {
				this.setStorageItems({ countdownEnabled: false })
				this.disableCountdown()
			}
		})

		this.$closeDuplicatesSwitch.addEventListener("change", () => {
			this.setStorageItems({
				closeDuplicates: this.$closeDuplicatesSwitch.checked,
			})
		})
	},

	setStorageListeners() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				switch (key) {
					case "tabs":
						this.tabs = newValue
						this.populateTracker()
						break

					default:
						break
				}
			}
		})
	},

	setStorageItems(items, callback) {
		chrome.storage.sync
			.set(items)
			.then(callback)
			.catch((e) => this.displayErrorMessage(e))
	},

	populateTracker() {
		this.$tabsTrackerTable.replaceChildren()
		this.tabs.forEach((tab, index) => {
			const row = this.$tabsTrackerTable.insertRow(index)

			const urlCell = row.insertCell(0)
			const timeOpenCell = row.insertCell(1)
			const usageCell = row.insertCell(2)

			const url = tab.url
			const timeOpen = milliToMin(Date.now() - tab.createdAt)
			const usage = tab.activeAt
				? milliToMin(Date.now() - tab.activeAt)
				: milliToMin(tab.activeDuration)

			urlCell.appendChild(document.createTextNode(url))
			timeOpenCell.appendChild(document.createTextNode(timeOpen))
			usageCell.appendChild(document.createTextNode(usage))
		})
	},

	setTrackerInterval() {
		this.trackerInterval = setInterval(() => this.populateTracker(), 20000)
	},

	enableMaxTabs() {
		this.$maxTabsSwitch.checked = true
	},

	disableMaxTabs() {
		this.$maxTabsSwitch.checked = false
	},

	enableCountdown() {
		this.$countdownSwitch.checked = true
	},

	disableCountdown() {
		this.$countdownSwitch.checked = false
	},

	hasExtraTabs() {
		return Number(this.$maxTabsInput.value) < this.tabs.length
	},

	displayErrorMessage(e) {
		console.error(e)
		this.$message.textContent = "Something went wrong, please try again later."
	},

	displayTabsMessage() {
		const extraTabs = this.tabs.length - this.$maxTabsInput.value
		const tabText = extraTabs > 1 ? "tabs" : "tab"

		this.$message.textContent = `You need to close ${extraTabs} ${tabText}.`
	},

	resetMessage() {
		this.$message.textContent = ""
	},
}

window.onload = () => Popup.init()
