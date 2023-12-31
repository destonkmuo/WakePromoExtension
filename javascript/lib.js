function convertISO8601DurationToSeconds(duration) {
  const hourToSecondsRegex = parseInt((/(\d+)H/).exec(duration) != null && (/(\d+)H/).exec(duration)[1] * 3600 || 0);
  const minutesToSecondsRegex = parseInt((/(\d+)M/).exec(duration) != null && (/(\d+)M/).exec(duration)[1] * 60 || 0);
  const secondsRegex = parseInt((/(\d+)S/).exec(duration) != null &&(/(\d+)S/).exec(duration)[1] || 0);

  return hourToSecondsRegex + minutesToSecondsRegex + secondsRegex
}

var getInnerHTML = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.statusText);
  const data = await response.text();
  return data;
};

var getJSON = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.statusText);
  const data = await response.json();
  return data;
};