async function GetVideoInformation() {
	let start = Date.now();
	//ADD: Delete all created elements from an array

	var searchQuery = this.location.search;

	//Accesses the search query and returns the video ID after "?v="
	var endOfQuery = (searchQuery.indexOf('&') > 0 && searchQuery.indexOf('&')) || searchQuery.length;
	var videoID = decodeURIComponent(
		this.location.search.substring(searchQuery.indexOf('?v=') + 3, endOfQuery),
	);

	//Scrapes through the body of the HTML file and accesses the transcript API
	var transcriptRegExp = new RegExp(
		/playerCaptionsTracklistRenderer.*?(youtube.com\/api\/timedtext.*?)"/,
	);

	const text = await getInnerHTML(searchQuery);
	//Guard condition
	if (transcriptRegExp.exec(text) == null || videoID == null || videoID == '') {
		return {
			type: 'videoInfo',
			data: null,
			name: null,
		};
	}

	var transcriptJSON;
	try {
		//Creator's Transcript + Formats and finalizes the transcript URL
		transcriptJSON = await getJSON(decodeURIComponent(JSON.parse(`"${'https://' + transcriptRegExp.exec(text)[1].substring(0, transcriptRegExp.exec(text)[1].indexOf('kind=asr')) + 'lang=en-US&fmt=json3'}"`)));
	} catch (error) {
		//Auto-generated Transcript + Formats and finalizes the transcript URL
		transcriptJSON = await getJSON( decodeURIComponent(JSON.parse( `"${ 'https://' + transcriptRegExp .exec(text)[1].substring(0, transcriptRegExp.exec(text)[1].indexOf('lang')) + 'lang=en&fmt=json3' }"`)));
	}

	var transcript = [];
	var events = transcriptJSON.events;

	for (speechSegment in events) {
		var sentence = (events[speechSegment].segs != null && events[speechSegment].segs) || null;
		//Filters out sentences that return as null or new line text
		if (sentence == null || sentence[0].utf8 == '\n') continue;
		//Pushes the sentence and time stamp to the transcript array
		transcript.push({
			time: events[speechSegment].tStartMs / 1000,
			sentence: sentence
				.map((word) => word.utf8.toLowerCase())
				.join('')
				.replace('\n', ' ')
				.replace(/[^a-zA-Z\s]/g, ''),
		});
	}

	console.log(transcript);

	//Fetches the videos description using youtubes API
	const videoJSON = await getJSON(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet&part=contentDetails&id=${videoID}&key=${'AIzaSyDYT9crIFi_OXGxtdr4gkfe2gRKykgFuyU'}`);

	const items = videoJSON.items[0];
	const snippet = items.snippet;

	var videoInfo = {
		description: snippet.description,
		title: snippet.title,
		channelTitle: snippet.channelTitle,
		tags: snippet.tags,
		category: snippet.categoryId,
		duration: convertISO8601DurationToSeconds(items.contentDetails.duration) - 1,
		transcript: transcript,
	};

	var newVideo = new PotentialSponsor(videoInfo);

	const potentialSponsors1 = await newVideo.spellCheck();
	const potentialSponsors2 = newVideo.capitalCheck();
	const potentialSponsors3 = newVideo.extractedLinksCheck();
	const potentialSponsors4 = newVideo.nounsRecog();
	const potentialSponsors5 = await newVideo.companyRecog();
	const potentialSponsors6 = newVideo.proximityToRelevance();

	newVideo.cleanSponsorFrequency();

	const sponsorFilter1 = newVideo.firstBreadth();
	const sponsorFilter2 = newVideo.proximityToLink();
	const sponsorFilter3 = newVideo.transcriptProximityToRelevance();

	for (const sponsor in newVideo.sponsors)
		if (newVideo.sponsors[sponsor] < 9) delete newVideo.sponsors[sponsor];

		
	console.log(newVideo.PotentialSponsors);
	console.log(newVideo.sponsors);

	//NOTE: REMOVE ALL FOR EACH LOOPS
	//NOTE: IMPLEMENT SAME WORD CLUSTER

	for (const sponsor in newVideo.sponsors) {
		for (const transcriptIndex in transcript) {
			const element = transcript[transcriptIndex];
			const wordsInSentence = element.sentence.split(/\s+/);
		wordsInSentence.forEach((transcriptWord) => {
			if (transcriptWord.length >= 4) {
					if (similarity(sponsor, transcriptWord) > 0.75 || (transcriptWord.length >= sponsor.length * 0.7 && sponsor.includes(transcriptWord))) {
						if (newVideo.sponsorClusters[sponsor] == null) {
							newVideo.sponsorClusters[sponsor] = {
								startTime: element.time,
								endTime: element.time,
								count: 0,
							};
						}
						newVideo.sponsorClusters[sponsor].count += 1;
						if (element.time > newVideo.sponsorClusters[sponsor].startTime && element.time <= newVideo.sponsorClusters[sponsor].endTime + 45) {
							newVideo.sponsorClusters[sponsor].endTime = transcript[Number(transcriptIndex) + 1].time + 1;
						} else {
							newVideo.sponsorClusters[sponsor].startTime = element.time;
							newVideo.sponsorClusters[sponsor].endTime = transcript[Number(transcriptIndex) + 1].time + 1;
						}	
					}
				}
			});
		}
		if (newVideo.sponsorClusters[sponsor] != null && (newVideo.sponsorClusters[sponsor].count < 2 || newVideo.sponsorClusters[sponsor].count >= 15)) delete newVideo.sponsorClusters[sponsor];
	}
	//Maybe check for extension of ad by key words(buy, percent, etc)), rather than arbitrary ints
	//Maybe points of interest must have keyterms around them in order to be chosen
	newVideo.cleanClusters();

	newVideo.generateTimeStamps();

	console.log(newVideo.sponsorClusters);
	console.log(
		potentialSponsors1,
		potentialSponsors2,
		potentialSponsors3,
		potentialSponsors4,
		potentialSponsors5,
		potentialSponsors6
	);
	console.log(sponsorFilter1, sponsorFilter2, sponsorFilter3);

	let timeTaken = Date.now() - start;
	console.log('Total time taken : ' + timeTaken / 1000 + 'seconds');

	const checkForTimeSkip = setInterval(function () {
		try {
			chrome.storage.sync.get(['skipPromotions'], function (result) {
				var video = document.getElementsByClassName('video-stream html5-main-video')[0];
				for (const sponsor in newVideo.sponsorClusters) {
					var startTime = newVideo.sponsorClusters[sponsor].startTime;
					var endTime = newVideo.sponsorClusters[sponsor].endTime;
					//Once in range, if the user has a chat gpt key, prompt 5 seconds before charge and 10 seconds before predicted ad time 
					if ( video.currentTime >= startTime - 2 && video.currentTime < endTime + 2 && result['skipPromotions'] == 'true' ) {
						videoSkipTo(endTime + 2);
					} else if ( video.currentTime >= startTime - 4 && video.currentTime < endTime + 4 && result['skipPromotions'] == 'false' ) {
						timeSkipSuggestion(endTime + 7);
					}
				}
			});
		} catch (error) {}
	}, 500);

	window.addEventListener('yt-navigate-start', function () {
		clearInterval(checkForTimeSkip);
	});

	if (Object.keys(newVideo.sponsorClusters).length >= 1)
		return {
			type: 'videoInfo',
			data: newVideo.sponsorClusters,
			name: videoInfo.title,
			responseData: 'video-id: ' + videoID + '\ntranscript-url:' + decodeURIComponent( JSON.parse( `"${ 'https://' + transcriptRegExp .exec(text)[1] .substring(0, transcriptRegExp.exec(text)[1].indexOf('lang')) + 'lang=en&fmt=json3' }"`)) + '\npotential-sponsors:' + Object.keys(newVideo.sponsors).join(', ')
		};
		
	return {
		type: 'videoInfo',
		data: null,
		name: null,
	};
}

async function OnNewVideo() {
	const videoInfo = await GetVideoInformation();

	//ERROR: On Message Undefine???
	chrome.runtime.onMessage.addListener((message) => {
		if (message.isPopupOpen == true) {
			chrome.runtime.sendMessage(videoInfo);
		}
	});
}

//User changes video => update the attributes of the page
window.addEventListener('yt-navigate-finish', OnNewVideo);
