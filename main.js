AOS.init({
  duration: 1000,
  once: true
});

const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});
document.addEventListener('DOMContentLoaded', function() {
  var map = L.map('map', {
      center: [30, 0],
      zoom: 2,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      tap: false,
      keyboard: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: ''
  }).addTo(map);

  // Custom white icon for markers
  var whiteIcon = L.icon({
iconUrl: '/assets/location-pin.png', 
iconSize: [25, 25],  // Smaller size
iconAnchor: [12, 25],  // Adjust anchor according to new size
popupAnchor: [1, -20],  // Adjust popup according to new size
shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
shadowSize: [25, 25],  // Adjust shadow size
className: 'white-marker'  
});


  var cities = [
      {name: "Curitiba", coords: [-25.4290, -49.2671], comment: "Where i grew up and developed a solid foundation seeking knowledge, creativity, and environmental awareness."},
      {name: "London", coords: [51.5074, -0.1278], comment: "Expanded my horizons during my highschool years. Studied in a prestigious school in a global city, and discovered my love for computer science, design, and exploring the world."},
      {name: "Lisbon", coords: [38.7223, -9.1393], comment: "Started university with a goal of expanding my horizons, and participated as a scholar atendee on WebSummit, during my two years there."},
      {name: "Cologne", coords: [50.9375, 6.9603], comment: "Decided to continue my studies in Germany, where I worked on projects with a focus on sustainability and social impact."},
      {name: "Montreal", coords: [45.5017, -73.5673], comment: "Ended my studies in McGill University. started working with prompt engineering and developed my web development skills."},
  ];

  cities.forEach(function(city) {
      var marker = L.marker(city.coords, { icon: whiteIcon }).addTo(map);

      marker.bindTooltip("<strong>" + city.name + "</strong><br>" + city.comment, {
          direction: 'auto', // Automatically adjust the direction of the tooltip based on screen space
          offset: [10, -12],  // Offset to position tooltip above the marker
          opacity: 0.9,
          className: 'custom-tooltip',
          permanent: false,
          maxWidth: 200
      });
  });
});