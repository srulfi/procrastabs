window.onload = function () {
	const $tabsInput = document.querySelector("#tabs-input")

	chrome.storage.sync.get("tabs", (result) => {
		$tabsInput.value = result.tabs
	})
}
