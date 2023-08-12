// Send a message to the extension's background script
var isPopupOpen = false;
var firstVideo = true;
async function GetVideoInformation() {
    //ADD: Delete all created elements from an array

    var searchQuery = this.location.search

    //Accesses the search query and returns the video ID after "?v="
    var endOfQuery = searchQuery.indexOf("&") > 0 && searchQuery.indexOf("&") || searchQuery.length;
    var videoID = decodeURIComponent(this.location.search.substring(searchQuery.indexOf("?v=") + 3, endOfQuery))

    //Scrapes through the body of the HTML file and accesses the transcript API
    var transcriptRegExp = new RegExp(/playerCaptionsTracklistRenderer.*?(youtube.com\/api\/timedtext.*?)"/);

    var getInnerHTML = async _ => {
        const response = await fetch(searchQuery);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.text();
        return data;
    }

    var getJSON = async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        return data;
    }

    const text = await getInnerHTML()
    //Guard condition
    if (transcriptRegExp.exec(text) == null || videoID == null || videoID == "") {
        return
    }

    //Formats and finalizes the transcript URL
    var transcriptURL = decodeURIComponent(JSON.parse(`"${transcriptRegExp.exec(text)[1] + "&fmt=json3"}"`));
    transcriptURL = transcriptURL.substring(12, transcriptURL.length);

    //NOTE: Train the model for sentences like "link in the description"
    const transcriptJSON = await getJSON(transcriptURL);
    var transcript = [];
    var events = transcriptJSON.events;

    for (speechSegment in events) {
        var sentence = events[speechSegment].segs != null && events[speechSegment].segs || null;
        //Filters out sentences that return as null or new line text
        if (sentence == null || sentence[0].utf8 == "\n") {
            continue
        }
        //Pushes the sentence and time stamp to the transcript array
        transcript.push({
            time: events[speechSegment].tStartMs / 1000,
            sentence: (sentence.map(word => word.utf8.toLowerCase()).join("")).replace('\n', " ")
        });
    }
    console.log(transcript);

    //Fetches the videos description using youtubes API
    const videoJSON = await getJSON(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet&part=contentDetails&id=${videoID}&key=AIzaSyDYT9crIFi_OXGxtdr4gkfe2gRKykgFuyU`);
    const items = videoJSON.items[0];
    const snippet = items.snippet;
    const contentDetails = items.contentDetails;

    var videoInfo = {
        description: snippet.description,
        title: snippet.title,
        channelTitle: snippet.channelTitle,
        tags: snippet.tags,
        category: snippet.categoryId,
        duration: convertISO8601DurationToSeconds(contentDetails.duration) - 1
    }
    var newVideo = new YoutubeVideo(videoInfo);

    const companies = await (await newVideo.getCompanies()).json()

    const potentialSponsors1 = await newVideo.spellCheck();
    const potentialSponsors2 = newVideo.capitalCheck();
    const potentialSponsors3 = newVideo.extractedLinksCheck();
    const potentialSponsors4 = newVideo.firstBreadth();
    const potentialSponsors5 = newVideo.orgRecog();
    const potentialSponsors6 = newVideo.nounsRecog();

    newVideo.cleanSponsorFrequency();

    console.log(newVideo.sponsors);

    transcript.forEach(element => {
        const wordsInSentence = element.sentence.split(/\s+/);

        wordsInSentence.forEach(transcriptWord => {
            for (const sponsor in newVideo.sponsors) {
              if (sponsor == "cablemod") {
                console.log(sponsor, similarity(sponsor, transcriptWord), transcriptWord)
              }
                if (similarity(sponsor, transcriptWord) > 0.7) {
                    if (newVideo.sponsorClusters[sponsor] == null) {
                        newVideo.sponsorClusters[sponsor] = {
                            startTime: element.time,
                            endTime: element.time,
                            count: 0
                        }
                    }
                    newVideo.sponsorClusters[sponsor].count += 1
                    if (element.time > newVideo.sponsorClusters[sponsor].endTime && element.time < newVideo.sponsorClusters[sponsor].endTime * 1.4)
                        newVideo.sponsorClusters[sponsor].endTime = element.time
                    continue;
                }
            }
        })
    })

    newVideo.cleanClusters()

    const SendDataToPopUp = setInterval(function() {
      if (isPopupOpen) {
          chrome.runtime.sendMessage({
              type: 'video',
              data: newVideo.sponsorClusters,
              name: videoInfo.title
          });
          clearInterval(SendDataToPopUp);
      }
  }, 500)

    newVideo.generateTimeStamps()

    console.log(newVideo.sponsorClusters);

    console.log(potentialSponsors1, potentialSponsors2, potentialSponsors3, potentialSponsors4, potentialSponsors5, potentialSponsors6)

    
    const checkForTimeSkip = setInterval(function() {
        chrome.storage.sync.get(['skipPromotions'], function(result) {
        var video = document.getElementsByClassName('video-stream html5-main-video')[0];
        for (const sponsor in newVideo.sponsorClusters) {
        if (video.currentTime >= newVideo.sponsorClusters[sponsor].startTime - 2 && video.currentTime < newVideo.sponsorClusters[sponsor].endTime + 2 && result['skipPromotions'] == "true"){
          videoSkipTo(newVideo.sponsorClusters[sponsor].endTime + 2);
        } else if (video.currentTime >= newVideo.sponsorClusters[sponsor].startTime - 4 && video.currentTime < newVideo.sponsorClusters[sponsor].endTime + 4 && result['skipPromotions'] == "false") {
          timeSkipSuggestion(newVideo.sponsorClusters[sponsor].endTime + 7);
        }
      }
    })
    }, 500)

    window.addEventListener("yt-navigate-start",function() {if (!firstVideo) {clearInterval(checkForTimeSkip)}} )
    firstVideo = false;
     
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.isPopupOpen == true) {
        isPopupOpen = true;
        GetVideoInformation();
        // You can process the message or send a response back if needed
        createdElements.forEach(element => element.remove());
        chrome.runtime.sendMessage({
            type: 'video',
            data: 'data'
        });
    } else if (message.isPopupOpen == false) {
        isPopupOpen = false;
    }
});

//User changes video => update the attributes of the page
window.addEventListener("yt-navigate-finish", GetVideoInformation);