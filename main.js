// Versor class for smooth rotations
class Versor {
  static fromAngles([l, p, g]) {
    l *= Math.PI / 360;
    p *= Math.PI / 360;
    g *= Math.PI / 360;
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg
    ];
  }
  static toAngles([a, b, c, d]) {
    return [
      Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * 180 / Math.PI,
      Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * 180 / Math.PI
    ];
  }
  static interpolateAngles(a, b) {
    const i = Versor.interpolate(Versor.fromAngles(a), Versor.fromAngles(b));
    return t => Versor.toAngles(i(t));
  }
  static interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    a2 -= a1, b2 -= b1, c2 -= c1, d2 -= d1;
    const x = new Array(4);
    return t => {
      const l = Math.hypot(x[0] = a1 + a2 * t, x[1] = b1 + b2 * t, x[2] = c1 + c2 * t, x[3] = d1 + d2 * t);
      x[0] /= l, x[1] /= l, x[2] /= l, x[3] /= l;
      return x;
    };
  }
  static interpolate([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    let dot = a1 * a2 + b1 * b2 + c1 * c2 + d1 * d2;
    if (dot < 0) a2 = -a2, b2 = -b2, c2 = -c2, d2 = -d2, dot = -dot;
    if (dot > 0.9995) return Versor.interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]);
    const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
    const x = new Array(4);
    const l = Math.hypot(a2 -= a1 * dot, b2 -= b1 * dot, c2 -= c1 * dot, d2 -= d1 * dot);
    a2 /= l, b2 /= l, c2 /= l, d2 /= l;
    return t => {
      const theta = theta0 * t;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      x[0] = a1 * c + a2 * s;
      x[1] = b1 * c + b2 * s;
      x[2] = c1 * c + c2 * s;
      x[3] = d1 * c + d2 * s;
      return x;
    };
  }
}

// Initialize AOS
AOS.init({
  duration: 1000,
  once: true
});

// Hamburger menu functionality
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

// Globe and map functionality
document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.about-map');
  const width = container.clientWidth;
  const height = container.clientHeight;

  const cities = [
    { name: "Curitiba", coords: [-49.2671, -25.4290], country: "Brazil", comment: "Where I grew up and developed a solid foundation seeking knowledge, creativity, and environmental awareness." },
    { name: "London", coords: [-0.1278, 51.5074], country: "United Kingdom", comment: "Expanded my horizons during my high school years. Studied in a prestigious school in a global city, and discovered my love for computer science, design, and exploring the world." },
    { name: "Lisbon", coords: [-9.1393, 38.7223], country: "Portugal", comment: "Started university, and participated as a scholar attendee on WebSummit, during my two years there." },
    { name: "Cologne", coords: [6.9603, 50.9375], country: "Germany", comment: "Decided to continue my studies in Germany, where I worked on projects with a focus on sustainability and social impact." },
    { name: "Montreal", coords: [-73.5673, 45.5017], country: "Canada", comment: "Ended my studies at McGill University. Started working with prompt engineering and developed my web development skills." },
  ];

  let currentIndex = 0;

  const projection = d3.geoOrthographic()
    .scale(Math.min(width, height) / 2.5)
    .center([0, 0])
    .translate([width / 2, height / 2]);

  const initialScale = projection.scale();
  let path = d3.geoPath().projection(projection);

  const svg = d3.select(".about-map")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const globe = svg.append("circle")
    .attr("fill", "#1a4b77")  // Darker blue for ocean
    .attr("stroke", "#000")
    .attr("stroke-width", "0.2")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", initialScale);

  let map = svg.append("g");

  // Create a group for the flight paths
  const flightPathGroup = svg.append("g").attr("class", "flight-paths");

  d3.json("https://unpkg.com/world-atlas@1/world/110m.json")
    .then(data => {
      const countries = topojson.feature(data, data.objects.countries);
      map.append("g")
        .attr("class", "countries")
        .selectAll("path")
        .data(countries.features)
        .enter().append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", "#4CAF50")  // Light green color
        .attr("stroke", "#000")
        .attr("stroke-width", 0.1);

      addFlightPaths();
      rotateToNextCity();
    });

  // Only modifying these two functions, rest of the code stays exactly the same

  function addFlightPaths() {
    for (let i = 0; i < cities.length - 1; i++) {
      const source = cities[i].coords;
      const target = cities[i + 1].coords;

      const route = { type: "LineString", coordinates: [source, target] };
      flightPathGroup.append("path")
        .datum(route)
        .attr("class", "flight-path")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", "white")
        .style("stroke-width", 2)
        .style("stroke-dasharray", function () {
          return this.getTotalLength() + " " + this.getTotalLength();
        })
        .style("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .style("opacity", 0); // Start invisible
    }
  }

  function rotateToNextCity() {
    if (currentIndex >= cities.length) {
      currentIndex = 0;
      flightPathGroup.selectAll("*").remove();
      addFlightPaths();
    }
  
    const city = cities[currentIndex];
    const [lambda, phi] = city.coords;
    const rotation = projection.rotate();
    const targetRotation = [-lambda, -phi, rotation[2]];
  
    // First rotate the globe
    d3.transition()
      .duration(2000)
      .tween("rotate", () => {
        const r = d3.interpolate(rotation, targetRotation);
        return t => {
          projection.rotate(r(t));
          svg.selectAll("path").attr("d", path);
        };
      })
      .on("end", () => {
        // Show first city info immediately after rotation
        if (currentIndex === 0) {
          showCityInfo(city);
          highlightCountry(city.country);
        }
        
        // Wait a bit, then animate the path
        setTimeout(() => {
          // Fade out previous path if it exists
          if (currentIndex > 0) {
            flightPathGroup.selectAll(".flight-path")
              .filter((d, i) => i === currentIndex - 1)
              .transition()
              .duration(1000)
              .style("opacity", 0);
          }
  
          // If there's a next city, draw the path to it
          if (currentIndex < cities.length - 1) {
            const currentPath = flightPathGroup.selectAll(".flight-path")
              .filter((d, i) => i === currentIndex);
            
            currentPath
              .style("opacity", 0.6)
              .transition()
              .duration(2000)
              .style("stroke-dashoffset", 0)
              .on("end", () => {
                // Show next city info and start next rotation
                setTimeout(() => {
                  showCityInfo(cities[currentIndex + 1]);
                  highlightCountry(cities[currentIndex + 1].country);
                  currentIndex++;
                  rotateToNextCity();
                }, 2000);
              });
          } else {
            currentIndex++;
            setTimeout(rotateToNextCity, 3000);
          }
        }, 1000); // Wait 1 second after rotation before drawing line
      });
  }
  function showCityInfo(city) {
    const infoDiv = d3.select("#city-info");
    infoDiv.html(`<h3>${city.name}, ${city.country}</h3><p>${city.comment}</p>`)
      .style("opacity", 0)
      .transition()
      .duration(500)
      .style("opacity", 1);
  }

  function highlightCountry(countryName) {
    svg.selectAll(".country")
      .transition()
      .duration(200)
      .attr("fill", d => d.properties.name === countryName ? "#1B5E20" : "#4CAF50")  // Darker green for selected country
      .attr("stroke", d => d.properties.name === countryName ? "#FFFFFF" : "#000")
      .attr("stroke-width", d => d.properties.name === countryName ? 1 : 0.1);
  }

  // Remove user interactions
  d3.select(".about-map").on("wheel.zoom", null);
  d3.select(".about-map").on("mousedown.drag", null);
  d3.select(".about-map").on("touchstart.drag", null);
});