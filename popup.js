const BTN_ACT_CLASS = "active"
const TRACKER_CLASS = "tracker-grid"
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

const getStorageStatsByDaysFromToday = async (today, daysAmount) => {
	const todayArray = today.split("-")
	const todayDate = new Date()

	todayDate.setFullYear(todayArray[0])
	todayDate.setMonth(todayArray[1] - 1)
	todayDate.setDate(todayArray[2])

	const statsByDays = [today]

	for (let i = 1; i < daysAmount; i += 1) {
		todayDate.setDate(todayDate.getDate() - 1)

		const year = todayDate.getFullYear()
		const month = todayDate.getMonth() + 1
		const day = todayDate.getDate()

		statsByDays.push(`${year}-${month}-${day}`)
	}

	const storageStats = await chrome.storage.sync.get(statsByDays)

	return storageStats
}

const getMaxTabsAverage = (stats) => {
	const validStats = Object.values(stats).filter((dayStats) => dayStats.maxTabs)
	const sum = Object.values(validStats).reduce(
		(acc, obj) => acc + obj.maxTabs,
		0
	)

	return Math.round(sum / validStats.length)
}

const Popup = {
	$maxTabsInput: document.querySelector("#maxtabs-input"),
	$maxTabsSwitch: document.querySelector("#maxtabs-switch"),
	$countdownInput: document.querySelector("#countdown-input"),
	$countdownSwitch: document.querySelector("#countdown-switch"),
	$closeDuplicatesSwitch: document.querySelector("#duplicates-switch"),
	$killAllModeSwitch: document.querySelector("#killallmode-switch"),
	$message: document.querySelector("#message"),
	$panels: document.querySelectorAll(".panel"),
	$panelButtons: document.querySelectorAll(".panel-button"),
	$trackerPanel: document.querySelector("#tracker-panel"),
	$statsPanel: document.querySelector("#stats-panel"),
	$settingsPanel: document.querySelector("#settings-panel"),
	$trackerButton: document.querySelector("#tracker-button"),
	$statsButton: document.querySelector("#stats-button"),
	$settingsButton: document.querySelector("#settings-button"),
	$resetTrackerButton: document.querySelector("#tracker-reset-button"),
	$statsMaxTabs: document.querySelector("#stats-max-tabs"),
	$statsMaxCountdown: document.querySelector("#stats-max-countdown"),
	$statsRangeButtons: document.querySelectorAll("#stats-range-selector button"),

	async init() {
		const config = await this.getConfigFromStorage()

		this.tabs = config.tabs
		this.today = config.today
		this.statsRange = config.statsRange

		this.$maxTabsInput.value = config.maxTabs
		this.$maxTabsSwitch.checked = config.maxTabsEnabled
		this.$countdownInput.value = config.countdown
		this.$countdownSwitch.checked = config.countdownEnabled
		this.$closeDuplicatesSwitch.checked = config.closeDuplicates
		this.$killAllModeSwitch.checked = config.killAllMode

		this.maxTabsInputMin = parseInt(this.$maxTabsInput.getAttribute("min"))
		this.maxTabsInputMax = parseInt(this.$maxTabsInput.getAttribute("max"))
		this.countdownInputMin = parseInt(this.$countdownInput.getAttribute("min"))
		this.countdownInputMax = parseInt(this.$countdownInput.getAttribute("max"))

		this.$statsRangeButtons.forEach(($rangeButton) => {
			if ($rangeButton.dataset.range === this.statsRange) {
				$rangeButton.classList.add(BTN_ACT_CLASS)
			}
		})

		this.setEventListeners()
		this.setStorageListeners()
		this.populateTracker()
		this.populateStats()
		this.setTrackerInterval()
	},

	async getConfigFromStorage() {
		try {
			const config = await chrome.storage.sync.get()
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
					killAllMode: false,
				})
				this.disableMaxTabs()
				this.disableCountdown()
				this.disableKillAllMode()
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
					killAllMode: false,
				})
				this.disableCountdown()
				this.disableKillAllMode()
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
				this.setStorageItems({ countdownEnabled: false, killAllMode: false })
				this.disableCountdown()
				this.disableKillAllMode()
			}
		})

		this.$closeDuplicatesSwitch.addEventListener("change", () => {
			this.setStorageItems({
				closeDuplicates: this.$closeDuplicatesSwitch.checked,
			})
			this.resetMessage()
		})

		this.$killAllModeSwitch.addEventListener("change", () => {
			if (this.$killAllModeSwitch.checked) {
				if (this.hasExtraTabs()) {
					this.disableKillAllMode()
					this.displayTabsMessage()
				} else {
					this.setStorageItems({
						maxTabsEnabled: true,
						countdownEnabled: true,
						killAllMode: true,
					})
					this.enableMaxTabs()
					this.enableCountdown()
					this.resetMessage()
				}
			} else {
				this.setStorageItems({ killAllMode: false })
			}
		})

		this.$trackerButton.addEventListener("click", () => {
			if (this.$trackerButton.classList.contains(BTN_ACT_CLASS)) {
				this.$trackerButton.classList.remove(BTN_ACT_CLASS)
				this.$trackerPanel.classList.remove(BTN_ACT_CLASS)
			} else {
				this.$panels.forEach(($panel) => $panel.classList.remove(BTN_ACT_CLASS))
				this.$panelButtons.forEach(($panelButton) =>
					$panelButton.classList.remove(BTN_ACT_CLASS)
				)
				this.$trackerPanel.classList.add(BTN_ACT_CLASS)
				this.$trackerButton.classList.add(BTN_ACT_CLASS)
			}
			this.resetMessage()
		})

		this.$statsButton.addEventListener("click", () => {
			if (this.$statsButton.classList.contains(BTN_ACT_CLASS)) {
				this.$statsButton.classList.remove(BTN_ACT_CLASS)
				this.$statsPanel.classList.remove(BTN_ACT_CLASS)
			} else {
				this.$panels.forEach(($panel) => $panel.classList.remove(BTN_ACT_CLASS))
				this.$panelButtons.forEach(($panelButton) =>
					$panelButton.classList.remove(BTN_ACT_CLASS)
				)
				this.$statsPanel.classList.add(BTN_ACT_CLASS)
				this.$statsButton.classList.add(BTN_ACT_CLASS)
			}
			this.resetMessage()
		})

		this.$settingsButton.addEventListener("click", () => {
			if (this.$settingsButton.classList.contains(BTN_ACT_CLASS)) {
				this.$settingsButton.classList.remove(BTN_ACT_CLASS)
				this.$settingsPanel.classList.remove(BTN_ACT_CLASS)
			} else {
				this.$panels.forEach(($panel) => $panel.classList.remove(BTN_ACT_CLASS))
				this.$panelButtons.forEach(($panelButton) =>
					$panelButton.classList.remove(BTN_ACT_CLASS)
				)
				this.$settingsPanel.classList.add(BTN_ACT_CLASS)
				this.$settingsButton.classList.add(BTN_ACT_CLASS)
			}
			this.resetMessage()
		})

		this.$resetTrackerButton.addEventListener("click", () => {
			chrome.runtime.sendMessage({ id: "tracker-reset" })
		})

		this.$statsRangeButtons.forEach(($statsRangeButton) => {
			$statsRangeButton.addEventListener("click", (e) => {
				const { range } = e.target.dataset

				this.$statsRangeButtons.forEach(($button) =>
					$button.classList.remove(BTN_ACT_CLASS)
				)
				e.target.classList.add(BTN_ACT_CLASS)

				this.statsRange = range
				this.setStorageItems({ statsRange: range })
				this.populateStats()
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
						if (!this.hasExtraTabs()) {
							this.resetMessage()
						}
						break

					case "today":
						this.today = newValue
						break

					case this.today:
						this.updateStats(newValue)
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
			.querySelectorAll(`.${TRACKER_CLASS}`)
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
				tab.activeAt && titleEl.classList.add(TRACKER_TITLE_ACT_CLASS)

				titleEl.style.backgroundImage = `url('chrome-extension://${
					chrome.runtime.id
				}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=14')`

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

			this.$trackerPanel.appendChild(windowTabsGrid)
		})
	},

	async getStatsBySelectedRange() {
		let stats
		let rangeDays

		if (this.statsRange === "week") {
			rangeDays = 7
		} else if (this.statsRange === "month") {
			rangeDays = 30
		} else if (this.statsRange === "year") {
			rangeDays = 365
		}

		switch (this.statsRange) {
			case "day":
				stats = await chrome.storage.sync.get(this.today)
				return { maxTabs: stats[this.today]?.maxTabs }

			case "week":
			case "month":
			case "year":
				stats = await getStorageStatsByDaysFromToday(this.today, rangeDays)
				const rangeMaxTabsAverage = getMaxTabsAverage(stats)

				return { maxTabs: rangeMaxTabsAverage }
		}
	},

	async populateStats() {
		try {
			const stats = await this.getStatsBySelectedRange()

			if (stats?.maxTabs) {
				this.$statsMaxTabs.textContent = stats.maxTabs
			}
		} catch (e) {
			console.error(e)
		}
	},

	updateStats(newStats) {
		if (newStats.maxTabs) {
			this.$statsMaxTabs.textContent = newStats.maxTabs
		}
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

	disableKillAllMode() {
		this.$killAllModeSwitch.checked = false
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

window.onload = () => {
	chrome.runtime.connect({ name: "popup" })
	Popup.init()
}
