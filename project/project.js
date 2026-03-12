let globalData = [];
let currentProfile = 'All Users';

// Load and parse the CSV data
Papa.parse("enriched_data.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) {
    if (results.errors.length > 0) {
      console.error("Errors during parsing:", results.errors);
    }
    globalData = results.data;
    initializeProfileSelector();
    analyzeData();
  },
  error: function (error) {
    console.error("Error loading or parsing CSV:", error);
  }
});

const NETFLIX_AVATARS = [
  './icons/kids.png',
  './icons/luli.png',
  './icons/nuno.png',
  './icons/pati.png',
  './icons/pedro.png',
];

// -----------------------------------------------------------
// Hour formatting helper
// If hours >= 100: show rounded whole hours, e.g. "913 hrs"
// If hours < 100:  show hours + minutes, e.g. "6 hrs 48 min"
// -----------------------------------------------------------
function formatHours(hours) {
  if (hours >= 100) {
    return `${Math.round(hours)} hrs`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} min`;
}

function initializeProfileSelector() {
  const profileSelector = document.getElementById('profile-selector');
  const profiles = ['All Users', ...new Set(globalData.map(d => d['Profile Name']))];

  profiles.forEach((profile, index) => {
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    profileContainer.onclick = () => selectProfile(profile);

    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';

    if (profile === 'All Users') {
      avatar.textContent = 'A';
      avatar.style.backgroundColor = '#E50914';
      avatar.style.color = 'white';
      avatar.style.fontWeight = 'bold';
    } else {
      const img = document.createElement('img');
      img.src = NETFLIX_AVATARS[index % NETFLIX_AVATARS.length];
      img.alt = profile;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.borderRadius = '4px';
      avatar.appendChild(img);
    }

    const nameLabel = document.createElement('div');
    nameLabel.className = 'profile-name';
    nameLabel.textContent = profile;

    profileContainer.appendChild(avatar);
    profileContainer.appendChild(nameLabel);
    profileSelector.appendChild(profileContainer);
  });

  selectProfile('All Users');
}

function selectProfile(profile) {
  currentProfile = profile;

  document.querySelectorAll('.profile-container').forEach(container => {
    const profileName = container.querySelector('.profile-name').textContent;
    container.classList.remove('active');

    if (profileName === profile) {
      container.classList.add('active');
    }
  });

  analyzeData();
}

function analyzeData() {
  const filteredData = currentProfile === 'All Users'
    ? globalData
    : globalData.filter(d => d['Profile Name'] === currentProfile);

  // Process data
  filteredData.forEach(d => {
    if (d.Duration && typeof d.Duration === 'string') {
      const [hours, minutes, seconds] = d.Duration.split(':').map(Number);
      d.DurationHours = hours + minutes / 60 + seconds / 3600;
    } else {
      d.DurationHours = 0;
    }
    d.StartTime = new Date(d['Start Time']);
  });

  const totalHours = d3.sum(filteredData, d => d.DurationHours);

  const userAnalysis = {
    profile: currentProfile,
    totalViews: filteredData.length,
    totalHours: totalHours,
    averageDurationHours: filteredData.length > 0 ? (totalHours / filteredData.length) : 0,
    favoriteGenre: getMostCommonGenre(filteredData),
    mostWatchedSeries: getMostWatchedByCategory(filteredData, 'series'),
    mostWatchedMovie: getMostWatchedByCategory(filteredData, 'movie'),
    preferredDevice: getPreferredDevice(filteredData),
    viewingHabits: getViewingHabits(filteredData)
  };

  renderUserAnalysis(userAnalysis);
  renderOverallAnalysis(filteredData);
  renderViewingPatterns(filteredData);
  renderContentPopularity(filteredData, 'title-chart');
}

function renderUserAnalysis(userAnalysis) {
  const userAnalysisHtml = `
    <h2>${userAnalysis.profile}'s Viewing Habits</h2>
    <table style="width: 100%; table-layout: fixed;">
        <colgroup>
            <col style="width: 40%;">
            <col style="width: 60%;">
        </colgroup>
        <tr><th>Total Hours Watched</th><td>${formatHours(userAnalysis.totalHours)}</td></tr>
        <tr><th>Favorite Genre</th><td>${userAnalysis.favoriteGenre}</td></tr>
        <tr><th>Top Series</th><td>${userAnalysis.mostWatchedSeries}</td></tr>
        <tr><th>Top Movie</th><td>${userAnalysis.mostWatchedMovie}</td></tr>
        <tr><th>Preferred Device</th><td>${userAnalysis.preferredDevice}</td></tr>
        <tr><th>Viewing Personality</th><td>${userAnalysis.viewingHabits}</td></tr>
    </table>
    `;

  document.getElementById('user-analysis').innerHTML = userAnalysisHtml;
}

function renderOverallAnalysis(data) {
  const topDevices = d3.rollups(data,
    v => d3.sum(v, d => d.DurationHours),
    d => categorizeDevice(d['Device Type']))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topGenres = d3.rollups(data.flatMap(d => {
    const genresString = d.TMDb_Genres || '';
    const genres = genresString.split(',').map(g => g.trim()).filter(g => g !== '');
    return genres.length > 0 ? genres.map(genre => ({genre, hours: d.DurationHours || 0})) : [{genre: 'Unknown', hours: d.DurationHours || 0}];
  }), v => d3.sum(v, d => d.hours), d => d.genre)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topCountries = d3.rollups(data, v => d3.sum(v, d => d.DurationHours), d => d.Country)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  createPieChart(topGenres, '#genres-chart', 'TMDb_Genres', 'Total Hours Watched');
  createPieChart(topDevices, '#device-chart', 'Device Type', 'Total Hours Watched');
  createWorldMap(topCountries, '#country-chart', 'Country', 'Total Hours Watched');
}

function renderViewingPatterns(data) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const viewsByHour = d3.rollups(
    data,
    v => d3.sum(v, d => d.DurationHours),
    d => d.StartTime.getHours()
  ).sort((a, b) => a[0] - b[0]);

  const viewsByDayOfWeek = d3.rollups(
    data,
    v => d3.sum(v, d => d.DurationHours),
    d => d.StartTime.getDay()
  )
    .map(d => [dayNames[d[0]], d[1]])
    .sort((a, b) => dayNames.indexOf(a[0]) - dayNames.indexOf(b[0]));

  createRadialChart(viewsByHour, '#hourly-chart', 'Hour of Day', 'Total Hours Watched');
  createBarChart(viewsByDayOfWeek, '#daily-chart', 'Day of Week', 'Total Hours Watched');
}

function getMostCommonGenre(data) {
  const topGenre = d3.rollups(
    data.flatMap(d => {
      const genresString = d.TMDb_Genres || '';
      const genres = genresString.split(',').map(g => g.trim()).filter(g => g !== '');
      return genres.length > 0
        ? genres.map(genre => ({genre, hours: d.DurationHours || 0}))
        : [{genre: 'Unknown', hours: d.DurationHours || 0}];
    }),
    v => d3.sum(v, d => d.hours),
    d => d.genre
  )
    .sort((a, b) => b[1] - a[1])[0];

  return topGenre ? topGenre[0] : 'No genres found';
}

// Uses Formatted_Title + Title Category filter (same as carousel) for consistency
function getMostWatchedByCategory(data, category) {
  const filtered = data.filter(d => d['Title Category']?.toLowerCase() === category.toLowerCase());
  const shows = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.DurationHours),
    d => d['Formatted_Title'] || d['Title'] || 'Unknown'
  ).sort((a, b) => b[1] - a[1]);
  return shows.length > 0 ? shows[0][0] : 'N/A';
}

function getPreferredDevice(data) {
  const devices = d3.rollups(data,
    v => d3.sum(v, d => d.DurationHours),
    d => categorizeDevice(d['Device Type']))
    .sort((a, b) => b[1] - a[1]);
  return devices.length > 0 ? devices[0][0] : 'N/A';
}

function categorizeDevice(deviceType) {
  const deviceCategories = {
    TV: ['TV', 'Smart TV', 'Roku', 'Fire TV', 'Apple TV', 'Chromecast'],
    Phone: ['iPhone', 'Mobile', 'Android', 'iOS', 'Samsung'],
    Tablet: ['iPad'],
    Laptop: ['MAC', 'Mac', 'Macbook', 'Firefox'],
    PC: ['PC', 'iMac'],
    Videogame: ['PS4', 'Wii', 'Xbox'],
  };

  for (let category in deviceCategories) {
    if (deviceCategories[category].some(device => deviceType.toLowerCase().includes(device.toLowerCase()))) {
      return category;
    }
  }
  return 'Other';
}

function getViewingHabits(data) {
  const morningHours    = d3.sum(data.filter(d => d.StartTime.getHours() >= 5  && d.StartTime.getHours() < 12), d => d.DurationHours);
  const afternoonHours  = d3.sum(data.filter(d => d.StartTime.getHours() >= 12 && d.StartTime.getHours() < 18), d => d.DurationHours);
  const eveningHours    = d3.sum(data.filter(d => d.StartTime.getHours() >= 18 && d.StartTime.getHours() < 21), d => d.DurationHours);
  const earlyNightHours = d3.sum(data.filter(d => d.StartTime.getHours() >= 21),  d => d.DurationHours);
  const lateNightHours  = d3.sum(data.filter(d => d.StartTime.getHours() >= 1  && d.StartTime.getHours() < 5),  d => d.DurationHours);

  const max = Math.max(morningHours, afternoonHours, eveningHours, earlyNightHours, lateNightHours);
  let timeSlot = "";
  if (max === morningHours)         timeSlot = "morning";
  else if (max === afternoonHours)  timeSlot = "afternoon";
  else if (max === eveningHours)    timeSlot = "evening";
  else if (max === earlyNightHours) timeSlot = "earlynight";
  else                              timeSlot = "latenight";

  // Find the top genre (by watch hours) for this time slot
  const slotFilter = {
    morning:    d => d.StartTime.getHours() >= 5  && d.StartTime.getHours() < 12,
    afternoon:  d => d.StartTime.getHours() >= 12 && d.StartTime.getHours() < 18,
    evening:    d => d.StartTime.getHours() >= 18 && d.StartTime.getHours() < 21,
    earlynight: d => d.StartTime.getHours() >= 21,
    latenight:  d => d.StartTime.getHours() >= 1  && d.StartTime.getHours() < 5,
  };

  const slotData = data.filter(slotFilter[timeSlot]);
  const topGenreEntry = d3.rollups(
    slotData.flatMap(d => {
      const genres = (d.TMDb_Genres || '').split(',').map(g => g.trim()).filter(Boolean);
      return genres.length > 0
        ? genres.map(genre => ({ genre, hours: d.DurationHours || 0 }))
        : [{ genre: 'Unknown', hours: d.DurationHours || 0 }];
    }),
    v => d3.sum(v, d => d.hours),
    d => d.genre
  ).sort((a, b) => b[1] - a[1])[0];

  const topGenre = topGenreEntry ? topGenreEntry[0].toLowerCase() : '';

  // Personality matrix: [timeSlot][genreKeyword] → label
  const personalities = {
    morning: [
      { match: ['animation', 'family'],               label: 'Breakfast Binger'       },
      { match: ['comedy'],                             label: 'Morning Laugher'        },
      { match: ['documentary'],                        label: 'Early Bird Scholar'     },
      { match: ['crime', 'thriller'],                  label: 'Morning Detective'      },
      { match: ['romance'],                            label: 'Romantic Riser'         },
      { match: [],                                     label: 'Morning Viewer'         },
    ],
    afternoon: [
      { match: ['animation', 'family'],               label: 'Siesta Binger'          },
      { match: ['romance', 'drama'],                  label: 'Afternoon Dreamer'      },
      { match: ['comedy'],                             label: 'Lunch Break Laugher'    },
      { match: ['documentary'],                        label: 'Afternoon Scholar'      },
      { match: ['action', 'adventure'],               label: 'Afternoon Adrenaline'   },
      { match: [],                                     label: 'Afternoon Viewer'       },
    ],
    evening: [
      { match: ['action', 'adventure'],               label: 'Rush Hour Adrenaline'   },
      { match: ['drama'],                              label: 'Wind-Down Dramatist'    },
      { match: ['thriller', 'mystery', 'crime'],      label: 'Evening Thriller'       },
      { match: ['comedy'],                             label: 'Post-Work Laugher'      },
      { match: ['horror'],                             label: 'Dusk Horror Fan'        },
      { match: ['romance'],                            label: 'Sunset Romantic'        },
      { match: [],                                     label: 'After Work Viewer'      },
    ],
    earlynight: [
      { match: ['horror'],                             label: 'Nightmare Fuel Addict'  },
      { match: ['documentary'],                        label: 'Bedtime Scholar'        },
      { match: ['romance', 'drama'],                  label: 'Sweet Dreams Romantic'  },
      { match: ['comedy'],                             label: 'Sleepy Laugher'         },
      { match: ['thriller', 'crime', 'mystery'],      label: 'Lights-Out Thriller'    },
      { match: ['animation', 'family'],               label: 'Bedtime Story Fan'      },
      { match: [],                                     label: 'Before Bed Viewer'      },
    ],
    latenight: [
      { match: ['documentary'],                        label: 'Sleepy Scholar'         },
      { match: ['horror'],                             label: 'Midnight Horror Junkie' },
      { match: ['sci-fi', 'fantasy'],                 label: 'Midnight Theorist'      },
      { match: ['comedy'],                             label: 'Late Night Laugher'     },
      { match: ['crime', 'thriller', 'mystery'],      label: '3am Detective'          },
      { match: ['romance'],                            label: 'Midnight Romantic'      },
      { match: [],                                     label: 'Night Owl'              },
    ],
  };

  const options = personalities[timeSlot];
  for (const option of options) {
    if (option.match.length === 0) return option.label; // fallback
    if (option.match.some(keyword => topGenre.includes(keyword))) return option.label;
  }
  return 'Avid Viewer';
}

function renderContentPopularity(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  container.innerHTML = '';

  // Dropdown
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'dropdown-container';

  const dropdown = document.createElement('select');
  dropdown.id = 'content-type-dropdown';
  const options = ['Movie', 'Series'];
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.toLowerCase();
    optionElement.textContent = option;
    dropdown.appendChild(optionElement);
  });

  dropdownContainer.appendChild(dropdown);
  container.appendChild(dropdownContainer);

  // Carousel wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'wrapper';
  const section = document.createElement('section');
  wrapper.appendChild(section);
  container.appendChild(wrapper);

  const leftArrow = document.createElement('a');
  leftArrow.className = 'arrow__btn left-arrow';
  leftArrow.innerHTML = '&#8249;';
  section.appendChild(leftArrow);

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'scroll-container';
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'items';
  scrollContainer.appendChild(itemsContainer);
  section.appendChild(scrollContainer);

  const rightArrow = document.createElement('a');
  rightArrow.className = 'arrow__btn right-arrow';
  rightArrow.innerHTML = '&#8250;';
  section.appendChild(rightArrow);

  function renderContent(contentType) {
    let filteredData;
    if (contentType === 'all') {
      filteredData = data;
    } else {
      filteredData = data.filter(d => d['Title Category']?.toLowerCase() === contentType.toLowerCase());
    }

    const aggregatedData = d3.rollups(
      filteredData,
      v => ({
        totalDuration: d3.sum(v, d => d.DurationHours || 0),
        backdropUrl: v[0]?.['TMDb_Backdrop_URL'] || '',
        sampleTitle: v[0]?.['Title'] || 'Unknown Title'
      }),
      d => d['Formatted_Title'] || 'Unknown Title'
    )
      .map(([formattedTitle, info]) => ({
        title: formattedTitle,
        totalDuration: info.totalDuration,
        backdropUrl: info.backdropUrl,
        sampleTitle: info.sampleTitle
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 16);

    itemsContainer.innerHTML = '';

    if (aggregatedData.length === 0) {
      itemsContainer.textContent = `No ${contentType} data available`;
      return;
    }

    aggregatedData.forEach(item => {
      const carouselItem = document.createElement('div');
      carouselItem.className = 'item';

      const backdrop = document.createElement('div');
      backdrop.className = 'carousel-backdrop';
      backdrop.style.backgroundImage = `url(${item.backdropUrl || './icons/placeholder.jpeg'})`;

      const title = document.createElement('h3');
      title.className = 'carousel-title';
      title.textContent = item.title;

      const duration = document.createElement('p');
      duration.className = 'carousel-duration';
      duration.textContent = `watched ${formatHours(item.totalDuration)}`;

      carouselItem.appendChild(backdrop);
      carouselItem.appendChild(title);
      carouselItem.appendChild(duration);
      itemsContainer.appendChild(carouselItem);
    });
  }

  renderContent('movie');

  dropdown.addEventListener('change', (event) => {
    renderContent(event.target.value);
  });

  function scrollCarousel(scrollContainer, direction) {
    const scrollAmount = direction * 1200;
    const startTime = performance.now();
    const startScrollLeft = scrollContainer.scrollLeft;
    const duration = 1000;

    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeInOutCubic(progress);
      scrollContainer.scrollLeft = startScrollLeft + (scrollAmount * easeProgress);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  leftArrow.addEventListener('click', () => scrollCarousel(scrollContainer, -1));
  rightArrow.addEventListener('click', () => scrollCarousel(scrollContainer, 1));
}