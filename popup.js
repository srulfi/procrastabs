window.onload = function () {
	const $tabsInput = document.querySelector("#tabs-input")

	chrome.storage.sync.get("tabsOpened", (result) => {
		$tabsInput.value = result.tabsOpened
	})
}
