/* NOTES
  //transform it using the ratio of (time of promo)/(video duration) to (pixel amount)/(width of progress bar)
  // The indicators shouldn't be hoverable or clickable and they should be semi transparent
  // full screen implementation
  //mainVideo.currentTime = 60;
*/

var createdElements = [];

function createTimeStamp(promotionStartTime, promotionEndTime, videoDuration) {
    // Check if the extension context is still valid before proceeding
    if (!chrome || !chrome.storage || !chrome.storage.sync || !chrome.storage.sync.get) {
        console.error("Extension context is not valid.");
        return;
    }

    chrome.storage.sync.get(['showPromotionDuration'], function(result) {
        if (result && result['showPromotionDuration'] == "false") { return }

        var progressBar = document.getElementsByClassName('ytp-timed-markers-container')[0];

        var div = document.createElement("div");

        div.style.width = 100 * (promotionEndTime - promotionStartTime)/videoDuration+"%"; // proportion of the diff to the duration of the vid
        div.style.height = "101%";
        div.style.background = "black";
        div.style.borderRadius = "1px";
        div.style.marginLeft = 100 * promotionStartTime/videoDuration+"%"; // Proportion of start pos
        div.style.transition = 'all 200ms ease-in-out';
        div.style.opacity = "100%";
        div.style.position = "absolute";

        progressBar.addEventListener("mouseenter", function() { 
            div.style.opacity = "90%";
        })
        progressBar.addEventListener("mouseleave", function() { 
            div.style.opacity = "50%";
        })
    
        document.body.appendChild(div);
        progressBar.appendChild(div);
        createdElements.push(div);   
        console.log(div);
    });
}

function videoSkipTo(promotionEndTime) {
    createdElements.forEach(element => element.remove());
    var video = document.getElementsByClassName('video-stream html5-main-video')[0];
    video.currentTime = promotionEndTime;
}

function timeSkipSuggestion(promotionEndTime) {
    createdElements.forEach(element => element.remove());
    videoSkipTo(promotionEndTime);// btn on click invoke this fnc
}

window.addEventListener("yt-navigate-start", function() {
    createdElements.forEach(element => element.remove());
});

// IGNORE -------------

commonRedundancies = ['twitter', 'tiktok', 'facebook', 'instagram', 'youtube', 
'itunes', 'snapchat', 'reddit', 'discord', 'twitch', 'geni', 'lmg', 'youtu', 
'spoti', 'soundcloud', 'https', 'media', 'group','sponsor', 'sponsors', 'referals', 
'spotify', 'podcast', 'outro', 'github'];