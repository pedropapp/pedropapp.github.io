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

// Auto-scroll functionality
class AutoScrollManager {
  constructor() {
    this.scrollTimeout = null;
    this.isAutoScrolling = false;
    this.hasUserScrolled = false;
    this.scrollIndicator = null;
    this.init();
  }

  init() {
    this.createScrollIndicator();
    this.setupScrollListeners();
    this.startScrollTimer();
  }

  createScrollIndicator() {
    // Create scroll indicator element
    this.scrollIndicator = document.createElement('div');
    this.scrollIndicator.className = 'scroll-indicator';
    this.scrollIndicator.innerHTML = `
      <div class="scroll-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="scroll-text">Scroll to explore</span>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .scroll-indicator {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 1000;
        pointer-events: none;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      
      .scroll-indicator.show {
        opacity: 1;
        animation: scrollPulse 2s infinite;
      }
      
      .scroll-arrow {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: bounce 2s infinite;
      }
      
      .scroll-text {
        background: rgba(0, 0, 0, 0.7);
        padding: 8px 16px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-10px);
        }
        60% {
          transform: translateY(-5px);
        }
      }
      
      @keyframes scrollPulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      
      @media (max-width: 768px) {
        .scroll-indicator {
          bottom: 20px;
          font-size: 12px;
        }
        
        .scroll-arrow {
          width: 36px;
          height: 36px;
        }
        
        .scroll-text {
          padding: 6px 12px;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(this.scrollIndicator);
  }

  setupScrollListeners() {
    // Listen for user scroll events
    window.addEventListener('scroll', () => {
      if (!this.isAutoScrolling) {
        this.hasUserScrolled = true;
        this.hideScrollIndicator();
        this.resetScrollTimer();
      }
    }, { passive: true });

    // Listen for other user interactions that indicate engagement
    ['mousedown', 'touchstart', 'keydown', 'click'].forEach(event => {
      document.addEventListener(event, () => {
        this.resetScrollTimer();
      }, { passive: true });
    });

    // Reset timer when user interacts with navigation or buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('a, button, .hamburger, .nav-links a')) {
        this.resetScrollTimer();
      }
    });
  }

  startScrollTimer() {
    this.clearScrollTimer();
    this.scrollTimeout = setTimeout(() => {
      this.performAutoScroll();
    }, 10000); // 10 seconds
  }

  resetScrollTimer() {
    this.clearScrollTimer();
    if (!this.hasUserScrolled && window.scrollY < 100) {
      this.startScrollTimer();
    }
  }

  clearScrollTimer() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
  }

  showScrollIndicator() {
    if (this.scrollIndicator && window.scrollY < 100) {
      this.scrollIndicator.classList.add('show');
      
      // Hide after 3 seconds
      setTimeout(() => {
        this.hideScrollIndicator();
      }, 3000);
    }
  }

  hideScrollIndicator() {
    if (this.scrollIndicator) {
      this.scrollIndicator.classList.remove('show');
    }
  }

  performAutoScroll() {
    // Only auto-scroll if user hasn't scrolled much and page has more content
    const currentScroll = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    if (currentScroll < 100 && documentHeight > windowHeight + 200) {
      // Show indicator first for 2 seconds
      this.showScrollIndicator();
      
      setTimeout(() => {
        this.isAutoScrolling = true;
        
        // Smooth scroll down 80px
        window.scrollTo({
          top: currentScroll + 80,
          behavior: 'smooth'
        });
        
        // Reset flag after scroll animation
        setTimeout(() => {
          this.isAutoScrolling = false;
          // Start timer again if user still hasn't scrolled much
          if (window.scrollY < 200) {
            this.startScrollTimer();
          }
        }, 800);
        
      }, 2000);
    }
  }

  destroy() {
    this.clearScrollTimer();
    if (this.scrollIndicator && this.scrollIndicator.parentNode) {
      this.scrollIndicator.parentNode.removeChild(this.scrollIndicator);
    }
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

// Initialize auto-scroll manager
const autoScrollManager = new AutoScrollManager();

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

  // Create groups for different elements
  const flightPathGroup = svg.append("g").attr("class", "flight-paths");
  const pinGroup = svg.append("g").attr("class", "pins");
  const planeGroup = svg.append("g").attr("class", "planes");

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

  function createPin(city) {
    const cityProjected = projection(city.coords);
    if (!cityProjected) return;
    
    const pin = pinGroup.append("g")
      .attr("class", "city-pin")
      .attr("transform", `translate(${cityProjected[0]}, ${cityProjected[1] - 5})`); // Offset up by 5px
    
    // Pin shadow
    pin.append("ellipse")
      .attr("cx", 0)
      .attr("cy", 15)
      .attr("rx", 8)
      .attr("ry", 3)
      .style("fill", "rgba(0,0,0,0.3)")
      .style("opacity", 0.6);
    
    // Pin body
    pin.append("path")
      .attr("d", "M0,-20 C-8,-20 -15,-13 -15,-5 C-15,3 0,15 0,15 C0,15 15,3 15,-5 C15,-13 8,-20 0,-20 Z")
      .style("fill", "#FF6B6B")
      .style("stroke", "#FF4757")
      .style("stroke-width", 2);
    
    // Pin inner circle
    pin.append("circle")
      .attr("cx", 0)
      .attr("cy", -5)
      .attr("r", 5)
      .style("fill", "white");
    
    // Pin pulse animation
    pin.append("circle")
      .attr("cx", 0)
      .attr("cy", -5)
      .attr("r", 5)
      .style("fill", "none")
      .style("stroke", "#FF6B6B")
      .style("stroke-width", 2)
      .style("opacity", 0)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("r", 15)
      .style("opacity", 0)
      .on("end", function() {
        d3.select(this).remove();
      });
    
    return pin;
  }

  function createPlane() {
    const plane = planeGroup.append("g")
      .attr("class", "plane")
      .style("opacity", 0);
    
    // Airplane body (fuselage)
    plane.append("path")
      .attr("d", "M 0,-2 L 16,-2 L 18,0 L 16,2 L 0,2 Z")
      .style("fill", "white")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    // Main wings
    plane.append("path")
      .attr("d", "M 4,-2 L 4,-8 L 10,-6 L 10,-2 Z")
      .style("fill", "white")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    plane.append("path")
      .attr("d", "M 4,2 L 4,8 L 10,6 L 10,2 Z")
      .style("fill", "white")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    // Tail wings
    plane.append("path")
      .attr("d", "M 0,-2 L -2,-4 L 2,-3 Z")
      .style("fill", "white")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    plane.append("path")
      .attr("d", "M 0,2 L -2,4 L 2,3 Z")
      .style("fill", "white")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    // Nose cone (pointed front)
    plane.append("path")
      .attr("d", "M 16,-2 L 20,0 L 16,2 Z")
      .style("fill", "#f0f0f0")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);
    
    // Cockpit window
    plane.append("circle")
      .attr("cx", 14)
      .attr("cy", 0)
      .attr("r", 1.5)
      .style("fill", "#4a90e2")
      .style("opacity", 0.7);
    
    return plane;
  }

  function animatePlane(pathElement, sourceCoords, targetCoords) {
    const plane = createPlane();
    const pathLength = pathElement.getTotalLength();
    
    plane.style("opacity", 1);
    
    return plane.transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .tween("plane-move", function() {
        return function(t) {
          const point = pathElement.getPointAtLength(t * pathLength);
          const nextPoint = pathElement.getPointAtLength(Math.min((t + 0.01) * pathLength, pathLength));
          
          // Calculate rotation angle
          const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180 / Math.PI;
          
          plane.attr("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
        };
      })
      .on("end", function() {
        plane.transition()
          .duration(300)
          .style("opacity", 0)
          .remove();
      });
  }

  function rotateToNextCity() {
    if (currentIndex >= cities.length) {
      currentIndex = 0;
      flightPathGroup.selectAll("*").remove();
      pinGroup.selectAll("*").remove();
      planeGroup.selectAll("*").remove();
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
          // Update pin positions during rotation
          pinGroup.selectAll(".city-pin").each(function(d, i) {
            const cityProjected = projection(cities[Math.min(currentIndex, cities.length - 1)].coords);
            if (cityProjected) {
              d3.select(this).attr("transform", `translate(${cityProjected[0]}, ${cityProjected[1] - 5})`);
            }
          });
        };
      })
      .on("end", () => {
        // Highlight country first
        highlightCountry(city.country);
        
        // Create pin for current city
        const pin = createPin(city);
        
        // Wait 4 seconds (longer landing time), then proceed to next city or flight
        setTimeout(() => {
          if (currentIndex < cities.length - 1) {
            // Remove pin and start flight
            pin.transition()
              .duration(500)
              .style("opacity", 0)
              .remove();
            
            // Hide city info when flight starts
            d3.select("#city-info")
              .transition()
              .duration(500)
              .style("opacity", 0);
            
            // Show flight path and animate plane
            setTimeout(() => {
              const currentPath = flightPathGroup.selectAll(".flight-path")
                .filter((d, i) => i === currentIndex);
              
              // Make path visible
              currentPath
                .style("opacity", 0.6)
                .transition()
                .duration(2000)
                .style("stroke-dashoffset", 0)
                .on("start", function() {
                  // Start plane animation
                  const pathElement = this;
                  animatePlane(pathElement, cities[currentIndex].coords, cities[currentIndex + 1].coords);
                })
                .on("end", () => {
                  // Hide the path
                  currentPath.transition()
                    .duration(500)
                    .style("opacity", 0);
                  
                  // Show city info for next city as soon as plane lands
                  showCityInfo(cities[currentIndex + 1]);
                  
                  // Move to next city
                  currentIndex++;
                  setTimeout(rotateToNextCity, 800);
                });
            }, 500);
          } else {
            // Remove pin and city info, then restart cycle
            pin.transition()
              .duration(500)
              .style("opacity", 0)
              .remove();
            
            d3.select("#city-info")
              .transition()
              .duration(500)
              .style("opacity", 0);
            
            currentIndex++;
            setTimeout(rotateToNextCity, 2000);
          }
        }, 4000); // Increased from 3000 to 4000ms for longer landing time
      });
  }
  
  function showCityInfo(city) {
    const infoDiv = d3.select("#city-info");
    // Check if we're on mobile (screen width < 768px)
    const isMobile = window.innerWidth < 768;
    
    if (!isMobile) {
      infoDiv.html(`<h3>${city.name}, ${city.country}</h3><p>${city.comment}</p>`)
        .style("opacity", 0)
        .transition()
        .duration(800)
        .style("opacity", 1);
    }
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