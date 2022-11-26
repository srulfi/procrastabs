const BTN_ACT_CLASS = "active"
const TRACKER_CLASS = "tabs-tracker-grid"
const TRACKER_TITLE_CLASS = "tab-title"
const TRACKER_TITLE_ACT_CLASS = "active"

const calculatePercentage = (total, sample) => {
	const perc = (sample * 100) / total
	return isNaN(perc) ? 0 : Math.round(perc)
}

const convertToDHM = (milliseconds) => {
	let minutes = Math.floor(milliseconds / 60000)
	let hours = Math.floor(minutes / 60)
	let days = Math.floor(hours / 24)

	minutes = minutes % 60
	hours = hours % 24

	const daysOutput = days ? `${days}d` : ""
	const hoursOutput = hours ? `${hours}h` : ""
	const minutesOutput = minutes ? `${minutes}m` : ""

	return days || hours || minutes
		? `${daysOutput} ${hoursOutput} ${minutesOutput}`
		: "0m"
}

const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$closeDuplicatesSwitch: document.querySelector("#duplicates-switch"),
	$suddenDeathSwitch: document.querySelector("#suddendeath-switch"),
	$message: document.querySelector("#message"),
	$tabsTracker: document.querySelector("#tabs-tracker"),
	$settings: document.querySelector("#settings"),
	$trackerButton: document.querySelector("#tracker-button"),
	$settingsButton: document.querySelector("#settings-button"),
	$resetTrackerButton: document.querySelector("#tracker-reset-button"),

	async init() {
		const config = await this.getConfigFromStorage()

		this.tabs = config.tabs
		this.$maxTabsInput.value = config.maxTabs
		this.$maxTabsSwitch.checked = config.maxTabsEnabled
		this.$countdownInput.value = config.countdown
		this.$countdownSwitch.checked = config.countdownEnabled
		this.$closeDuplicatesSwitch.checked = config.closeDuplicates
		this.$suddenDeathSwitch.checked = config.suddenDeath

		this.maxTabsInputMin = parseInt(this.$maxTabsInput.getAttribute("min"))
		this.maxTabsInputMax = parseInt(this.$maxTabsInput.getAttribute("max"))
		this.countdownInputMin = parseInt(this.$countdownInput.getAttribute("min"))
		this.countdownInputMax = parseInt(this.$countdownInput.getAttribute("max"))

		this.setEventListeners()
		this.setStorageListeners()
		this.populateTracker()
		this.setTrackerInterval()
	},

	async getConfigFromStorage() {
		try {
			const config = await chrome.storage.sync.get([
				"tabs",
				"maxTabs",
				"maxTabsEnabled",
				"countdown",
				"countdownEnabled",
				"closeDuplicates",
				"suddenDeath",
			])
			return config
		} catch (e) {
			this.displayErrorMessage(e)
		}
	},

	setEventListeners() {
		this.$maxTabsInput.addEventListener("change", (e) => {
			if (this.$maxTabsInput.value < this.maxTabsInputMin) {
				// user removed digits resulting in an invalid value
				this.$maxTabsInput.value = this.maxTabsInputMin
			}

			if (this.hasExtraTabs()) {
				this.setStorageItems({
					maxTabsEnabled: false,
					countdownEnabled: false,
					suddenDeath: false,
				})
				this.disableMaxTabs()
				this.disableCountdown()
				this.disableSuddenDeath()
			}

			this.setStorageItems({ maxTabs: parseInt(this.$maxTabsInput.value) })
			this.resetMessage()
		})

		this.$maxTabsInput.addEventListener("keydown", (e) => {
			return this.handleInvalidKeyboardValues(
				e,
				this.$maxTabsInput.value,
				this.maxTabsInputMin,
				this.maxTabsInputMax
			)
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
				this.setStorageItems({
					maxTabsEnabled: false,
					countdownEnabled: false,
					suddenDeath: false,
				})
				this.disableCountdown()
				this.disableSuddenDeath()
				this.resetMessage()
			}
		})

		this.$countdownInput.addEventListener("change", () => {
			if (this.$countdownInput.value < this.countdownInputMin) {
				// user removed digits resulting in an invalid value
				this.$countdownInput.value = this.countdownInputMin
			}

			this.setStorageItems({ countdown: Number(this.$countdownInput.value) })
			this.resetMessage()
		})

		this.$countdownInput.addEventListener("keydown", (e) => {
			return this.handleInvalidKeyboardValues(
				e,
				this.$countdownInput.value,
				this.countdownInputMin,
				this.countdownInputMax
			)
		})

		this.$countdownSwitch.addEventListener("change", () => {
			if (this.$countdownSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableCountdown()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({ maxTabsEnabled: true, countdownEnabled: true })
					this.enableMaxTabs()
					this.resetMessage()
				}
			} else {
				this.setStorageItems({ countdownEnabled: false, suddenDeath: false })
				this.disableCountdown()
				this.disableSuddenDeath()
			}
		})

		this.$closeDuplicatesSwitch.addEventListener("change", () => {
			this.setStorageItems({
				closeDuplicates: this.$closeDuplicatesSwitch.checked,
			})
			this.resetMessage()
		})

		this.$suddenDeathSwitch.addEventListener("change", () => {
			if (this.$suddenDeathSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableSuddenDeath()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({
						maxTabsEnabled: true,
						countdownEnabled: true,
						suddenDeath: true,
					})
					this.enableMaxTabs()
					this.enableCountdown()
					this.resetMessage()
				}
			} else {
				this.setStorageItems({ suddenDeath: false })
			}
		})

		this.$trackerButton.addEventListener("click", () => {
			if (this.$trackerButton.classList.contains(BTN_ACT_CLASS)) {
				this.$trackerButton.classList.remove(BTN_ACT_CLASS)
				this.$tabsTracker.classList.remove(BTN_ACT_CLASS)
			} else {
				this.$trackerButton.classList.add(BTN_ACT_CLASS)
				this.$tabsTracker.classList.add(BTN_ACT_CLASS)
				this.$settingsButton.classList.remove(BTN_ACT_CLASS)
				this.$settings.classList.remove(BTN_ACT_CLASS)
			}
			this.resetMessage()
		})

		this.$settingsButton.addEventListener("click", () => {
			if (this.$settingsButton.classList.contains(BTN_ACT_CLASS)) {
				this.$settingsButton.classList.remove(BTN_ACT_CLASS)
				this.$settings.classList.remove(BTN_ACT_CLASS)
			} else {
				this.$settingsButton.classList.add(BTN_ACT_CLASS)
				this.$settings.classList.add(BTN_ACT_CLASS)
				this.$trackerButton.classList.remove(BTN_ACT_CLASS)
				this.$tabsTracker.classList.remove(BTN_ACT_CLASS)
			}
			this.resetMessage()
		})

		this.$resetTrackerButton.addEventListener("click", () => {
			chrome.runtime.sendMessage({ id: "tracker-reset" })
		})
	},

	setStorageListeners() {
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				switch (key) {
					case "tabs":
						this.tabs = newValue
						this.populateTracker()
						if (!this.hasExtraTabs()) {
							this.resetMessage()
						}
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

	handleInvalidKeyboardValues(event, value, min, max) {
		const inputValue = parseInt(value + event.key)

		if (isNaN(inputValue) || inputValue < min || inputValue > max) {
			return event.preventDefault()
		}
	},

	populateTracker() {
		// clear tracker
		document
			.querySelectorAll(".tabs-tracker-grid")
			.forEach((windowTracker) => windowTracker.remove())

		// create tabs object by `windowId`
		const tabsByWindowObj = {}
		this.tabs.forEach((tab) => {
			const { windowId } = tab
			if (!tabsByWindowObj[windowId]) {
				tabsByWindowObj[windowId] = [tab]
			} else {
				tabsByWindowObj[windowId].push(tab)
			}
		})

		// sort by position in window (index)
		const tabsByWindowSorted = Object.values(tabsByWindowObj).map((tabsGroup) =>
			tabsGroup.sort((a, b) => a.index - b.index)
		)

		// render
		tabsByWindowSorted.forEach((windowTabs) => {
			const windowTabsGrid = document.createElement("div")
			windowTabsGrid.classList.add(TRACKER_CLASS)

			windowTabs.forEach((tab) => {
				const titleEl = document.createElement("span")
				const timeOpenEl = document.createElement("span")
				const timeActiveEl = document.createElement("span")

				const timeOpen = Date.now() - tab.createdAt
				const timeActive = tab.activeAt
					? tab.timeActive + Date.now() - tab.activeAt
					: tab.timeActive
				const timeActivePerc = calculatePercentage(timeOpen, timeActive)

				titleEl.classList.add(TRACKER_TITLE_CLASS)
				tab.active && titleEl.classList.add(TRACKER_TITLE_ACT_CLASS)

				titleEl.onclick = () => {
					const { index, windowId } = tab
					chrome.runtime.sendMessage({
						id: "tracker-tab-click",
						index,
						windowId,
					})
				}

				titleEl.textContent = tab.title
				timeOpenEl.textContent = convertToDHM(timeOpen)
				timeActiveEl.textContent = `${convertToDHM(
					timeActive
				)} (${timeActivePerc}%)`

				windowTabsGrid.appendChild(titleEl)
				windowTabsGrid.appendChild(timeOpenEl)
				windowTabsGrid.appendChild(timeActiveEl)
			})

			this.$tabsTracker.appendChild(windowTabsGrid)
		})
	},

	setTrackerInterval() {
		this.trackerInterval = setInterval(() => this.populateTracker(), 10000)
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

	disableSuddenDeath() {
		this.$suddenDeathSwitch.checked = false
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
