// maintain a map of tabs with unique identifier that becomes the language of all the 
// functions to interact with the tabs

document.addEventListener('DOMContentLoaded', function() {
  var poolList = [];
  //initialize a pool list here which is not an element
  var saveButton = document.getElementById('save');
  var tabListDiv = document.getElementById('tablist');
  var heading = document.getElementById('main-title');

  // The Tab list item
  function createTabListItem(tab) {
    var listItem = document.createElement('div');
    var content = (poolList.length + 1) + '. ' + tab.title;
    listItem.textContent = content;
    listItem.classList.add('tab-item');
    listItem.setAttribute('data-tab-id', tab.id);
    listItem.setAttribute('data-tab-url', tab.url);
    listItem.style.display = 'flex'; 
    listItem.style.alignItems = 'center'; 
    listItem.style.justifyContent = 'space-between'; 

    // Create a close button for the tab
    var closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.classList.add('close-button');
    closeButton.addEventListener('click', function(event) {
      event.stopPropagation();
      var tabId = parseInt(listItem.getAttribute('data-tab-id'));
      chrome.tabs.remove(tabId);
      listItem.remove();
    });
    listItem.appendChild(closeButton);

    listItem.addEventListener('click', function() {
      var tabId = parseInt(this.getAttribute('data-tab-id'));
      chrome.tabs.update(tabId, {active: true});
      window.close();
    });

    return listItem;
  }

  // The Tab list
  chrome.tabs.query({currentWindow: true}, function (tabs) {
    while (tabListDiv.firstChild) {
      tabListDiv.removeChild(tabListDiv.firstChild);
    }
    for (var i = 0; i < tabs.length; i++) {
      var listItem = createTabListItem(tabs[i]);
      heading.textContent = 'Tab Pool (' + (poolList.length + 1) + ')';
      poolList.push([(i + 1), tabs[i].index, tabs[i].title, tabs[i].url]);
      tabListDiv.appendChild(listItem);
    }
  });

  // New button to show tabIds
  var showTabIdsButton = document.getElementById('show-ids');
  showTabIdsButton.textContent = 'Show TabIds';
  showTabIdsButton.addEventListener('click', function() {
    for (let i = 0; i < tabListDiv.children.length; i++) {
      const listItem = tabListDiv.children[i];
      const tabId = listItem.getAttribute('data-tab-id');
      listItem.textContent = i + '. ' + tabId + ' -- title-wip';
    }
  });

  var group2rightButton = document.getElementById("group2right");
  group2rightButton.addEventListener("click", function (){
    // chrome.tabs.query({ windowType: 'normal' }, function(tabs) {
    //   var tabGroups = {};
  
    //   tabs.forEach(function(t) {
    //     if (t.groupId !== -1) {
    //       if (!tabGroups[t.groupId]) {
    //         tabGroups[t.groupId] = [];
    //       }
    //       tabGroups[t.groupId].push(t.id);
    //     }
    //   });
  
    //   Object.keys(tabGroups).forEach(function(groupId) {
    //     var groupTabs = tabGroups[groupId];
    //     var lastTab = tabs[tabs.length - 1];
  
    //     chrome.tabs.move(groupTabs, { index: lastTab.index + 1 });
    //   });
    // });
  });


  // Arxiv download button.
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var pageTitle = tabs[0].title;
    if (tabs[0].url.includes('arxiv.org')) {
      var downloadButton = document.getElementById('arxiv-download-button');
      downloadButton.textContent = 'Download Arxiv';
      downloadButton.addEventListener('click', function() {
        var fname = pageTitle.replace(/\W+/g, '_').toLowerCase()+ '_arxiv_paper' + '.pdf';
        console.log(fname);
        chrome.downloads.download({
          url: tabs[0].url,
          filename: fname
        });   
      });
    }
  });

  // Save button.
  saveButton.addEventListener('click', function() {
    var currentDate = new Date().toLocaleString().replace(/,/g, '').replace(/ /g, '_') + ".txt";
    saveAs(new Blob([poolList], {type: "text/plain;charset=utf-8"}), currentDate);
    // Log the path where the file is saved.
    console.log('File saved to: ' +  currentDate);
  });

  // Search Implementation
  const searchBar = document.getElementById('search-bar');
  searchBar.addEventListener('input', function() {
    const query = searchBar.value.toLowerCase();
    // Loop through the list of tabs and filter based on the query
    for (let i = 0; i < tabListDiv.children.length; i++) {
      const listItem = tabListDiv.children[i];
      const content = listItem.textContent.toLowerCase();
      const url = listItem.getAttribute('data-tab-url')
      if ((content + ' ' + url).includes(query)) {
        listItem.style.display = 'block';
      } else {
        listItem.style.display = 'none';
      }
    }
  });
  searchBar.focus();

  chrome.storage.local.get(['openerTabIdMap'], result => {
    console.log("map", result)
  });

});

