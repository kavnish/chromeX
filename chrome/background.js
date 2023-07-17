// This background script implements the extension button,
// and triggers the content script upon tab title change.

// Regular expressions for parsing target navigation URL from URLs.
// Ref: https://info.arxiv.org/help/arxiv_identifier_for_services.html#urls-for-standard-arxiv-functions
const TARGET_URL_REGEXP_REPLACE = [
  [/^.*:\/\/(?:export\.)?arxiv\.org\/abs\/(\S*?)\/*(\?.*?)?(\#.*?)?$/, "https://arxiv.org/pdf/$1.pdf"],
  [/^.*:\/\/(?:export\.)?arxiv\.org\/pdf\/(\S*?)(?:\.pdf)?\/*(\?.*?)?(\#.*?)?$/, "https://arxiv.org/abs/$1"],
  [/^.*:\/\/(?:export\.)?arxiv\.org\/ftp\/(?:arxiv\/|([^\/]*\/))papers\/.*?([^\/]*?)\.pdf(\?.*?)?(\#.*?)?$/, "https://arxiv.org/abs/$1$2"],
  [/^.*:\/\/ar5iv\.labs\.arxiv\.org\/html\/(\S*?)\/*(\?.*?)?(\#.*?)?$/, "https://arxiv.org/abs/$1"],
  [/^.*:\/\/www\.arxiv-vanity\.com\/papers\/(\S*?)\/?(\?.*?)?(\#.*?)?$/, "https://arxiv.org/abs/$1"],
  [/^.*:\/\/openreview\.net\/forum\?id=(\S*?)(&.*?)?(\#.*?)?$/, "https://openreview.net/pdf?id=$1"],
  [/^.*:\/\/openreview\.net\/pdf\?id=(\S*?)(&.*?)?(\#.*?)?$/, "https://openreview.net/forum?id=$1"],
  // Starting from 2022, NIPS urls may end with a `-Conference` suffix
  [/^.*:\/\/papers\.nips\.cc\/paper_files\/paper\/(\d*)\/(?:[^\/]*)\/(.*?)-Abstract(-Conference)?\.html(\?.*?)?(\#.*?)?$/,
    "https://papers.nips.cc/paper_files/paper/$1/file/$2-Paper$3.pdf"],
  [/^.*:\/\/papers\.nips\.cc\/paper_files\/paper\/(\d*)\/(?:[^\/]*)\/(.*?)-.*?(-Conference)?\..*?(\?.*?)?(\#.*?)?$/,
    "https://papers.nips.cc/paper_files/paper/$1/hash/$2-Abstract$3.html"],
  [/^.*:\/\/proceedings\.mlr\.press\/(.*?)\/(.*?)\.html(\?.*?)?(\#.*?)?$/, "https://proceedings.mlr.press/$1/$2/$2.pdf"],
  [/^.*:\/\/proceedings\.mlr\.press\/(.*?)\/(.*?)\/.*?(\?.*?)?(\#.*?)?$/, "https://proceedings.mlr.press/$1/$2.html"],
];
// All console logs should start with this prefix.
const LOG_PREFIX = "[arXiv-utils]";

// Return the target URL parsed from the url.
function getTargetURL(url) {
  for (const [regexp, replacement] of TARGET_URL_REGEXP_REPLACE) {
    if (regexp.test(url))
      return url.replace(regexp, replacement);
  }
  return null;
}
// Update browser action state for the updated tab.
function onTabUpdated(tabId, changeInfo, tab) {
  updateActionStateAsync(tabId, tab.url)
  const id = getTargetURL(tab.url);
  if (!id) return;
  if (changeInfo.title && tab.status == "complete") {
    // Send title changed message to content script.
    // Ref: https://stackoverflow.com/a/73151665
    console.log(LOG_PREFIX, "Title changed, sending message to content script.");
    chrome.tabs.sendMessage(tabId, tab);
  }
}

async function updateActionStateAsync(tabId, url) {
  const id = getTargetURL(url);
    await chrome.action.enable(tabId);
}

async function injectContentScriptsAsync() {
  // TODO: Fix errors:
  // - Injecting content scripts seems to cause error when
  //   disabling and re-enabling the extension very quickly with existing arXiv tabs:
  //       Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'sync')
  // - Another error seems to occur under unknown circumstances:
  //       Uncaught SyntaxError: Identifier 'ABS_REGEXP' has already been declared
  // - Another error seems to occur under unknown circumstances:
  //       Unchecked runtime.lastError: Cannot create item with duplicate id help
  for (const cs of chrome.runtime.getManifest().content_scripts) {
    for (const tab of await chrome.tabs.query({url: cs.matches})) {
      console.log(LOG_PREFIX, `Injecting content scripts for tab ${tab.id} with url: ${tab.url}.`);
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: cs.js,
      });
    }
  }
}


chrome.tabs.onCreated.addListener(tab =>  {
  chrome.storage.local.get(['openerTabIdMap'], result => {
    console.log("new tab ", tab)
    let openerTabIdMap = result.openerTabIdMap || {}
    if(tab.pendingUrl !== "chrome://newtab/" && tab.openerTabId) {
      openerTabIdMap[tab.id] = tab.openerTabId
    }
    console.log("openerTabIdMap: ", openerTabIdMap)
    chrome.storage.local.set({ openerTabIdMap });
  })
})

chrome.tabs.onRemoved.addListener((removedTabId, removeInfo) => {
  chrome.storage.local.get(['openerTabIdMap'], result => {
    console.log("remove tab ", removedTabId)
    let openerTabIdMap = result.openerTabIdMap || {}
    let openerTabId = openerTabIdMap[removedTabId]
    Object.keys(openerTabIdMap).forEach(key => {
      if(openerTabIdMap[key] === removedTabId) {
          openerTabIdMap[key] = openerTabId
      }
    });
    delete openerTabIdMap[removedTabId]
    chrome.storage.local.set({ openerTabIdMap });
  })
})


async function moveToFirstPosition(activeInfo) {
  try {
    await chrome.tabs.move(activeInfo.tabId, {index: 0});
    console.log("Success.");
  } catch (error) {
    if (error == "Error: Tabs cannot be edited right now (user may be dragging a tab).") {
      setTimeout(() => moveToFirstPosition(activeInfo), 50);
    } else {
      console.error(error);
    }
  }
}

chrome.tabs.onCreated.addListener(function(tab) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var currentTab = tabs[0];
    if (currentTab.groupId === -1) {
      // The current tab is not in a group, so move the new tab to index 0
      chrome.tabs.move(tab.id, {index: 0});
      console.log("Tab Moved to: ", tab.groupId);
    }
  });
});

chrome.tabs.onCreated.addListener(function(tab) {
  var tab_info = [];
  chrome.tabs.query({}, function(tabs) {
    for (var i = 0; i < tabs.length; i++){
      tab_info.push([i, tabs[i].url, tabs[i].title, tabs[i].groupId]);
    }
    // Configure the fetch request
    var requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({"Tab-Info": tab_info})
    };

    console.log("Posting Data : ", JSON.stringify({"Tab-Info": tab_info}), {"Tab-Info": tab_info}, typeof(tab_info), tab_info);
    
    // Send the POST request
    fetch('http://127.0.0.1:5000/push', requestOptions)
      .then(response => {
        if (response.ok) {
          console.log('POST request successful');
        } else {
          console.error('POST request failed', response);
        }
      })
      .catch(error => {
        console.error('Error sending POST request:', error);
      });
  });
});

chrome.tabs.query({}, function(tabs) {
  if (!tabs) return;
  for (const tab of tabs)
    updateActionStateAsync(tab.id, tab.url)
});

chrome.tabs.onUpdated.addListener(onTabUpdated);

injectContentScriptsAsync();
