// ─── AOS ─────────────────────────────────────────────────────────────────────
AOS.init({ duration: 1000, once: true });

// ─── Hamburger menu ───────────────────────────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('active'));
}

// ─── Versor (SLERP quaternion interpolation) ──────────────────────────────────
class Versor {
  static fromAngles([l, p, g]) {
    l *= Math.PI / 360; p *= Math.PI / 360; g *= Math.PI / 360;
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg,
    ];
  }
  static toAngles([a, b, c, d]) {
    return [
      Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * 180 / Math.PI,
      Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * 180 / Math.PI,
    ];
  }
  static interpolate([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    let dot = a1 * a2 + b1 * b2 + c1 * c2 + d1 * d2;
    if (dot < 0) { a2 = -a2; b2 = -b2; c2 = -c2; d2 = -d2; dot = -dot; }
    if (dot > 0.9995) {
      return t => {
        const x = [a1+(a2-a1)*t, b1+(b2-b1)*t, c1+(c2-c1)*t, d1+(d2-d1)*t];
        const l = Math.hypot(...x);
        return x.map(v => v / l);
      };
    }
    const theta0 = Math.acos(dot);
    const sin0   = Math.sin(theta0);
    return t => {
      const theta = theta0 * t;
      const s1 = Math.cos(theta) - dot * Math.sin(theta) / sin0;
      const s2 = Math.sin(theta) / sin0;
      return [a1*s1+a2*s2, b1*s1+b2*s2, c1*s1+c2*s2, d1*s1+d2*s2];
    };
  }
  static interpolateAngles(a, b) {
    const i = Versor.interpolate(Versor.fromAngles(a), Versor.fromAngles(b));
    return t => Versor.toAngles(i(t));
  }
}

// ─── Globe ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.about-map');
  if (!container) return;

  const width  = container.clientWidth  || 500;
  const height = container.clientHeight || 500;
  const scale  = Math.min(width, height) / 2.2;

  // Cities — [longitude, latitude]
  const cities = [
    { name: 'Curitiba', coords: [-49.2671, -25.4290], country: 'Brazil',
      comment: 'Where I grew up and developed a solid foundation seeking knowledge, creativity, and environmental awareness.' },
    { name: 'London',   coords: [-0.1278,  51.5074],  country: 'United Kingdom',
      comment: 'Expanded my horizons during high school. Discovered my love for computer science, design, and exploring the world.' },
    { name: 'Lisbon',   coords: [-9.1393,  38.7223],  country: 'Portugal',
      comment: 'Started university and attended WebSummit as a scholar during my two years there.' },
    { name: 'Cologne',  coords: [6.9603,   50.9375],  country: 'Germany',
      comment: 'Continued my studies in Germany, working on projects focused on sustainability and social impact.' },
    { name: 'Montreal', coords: [-73.5673, 45.5017],  country: 'Canada',
      comment: 'Finished my studies at McGill University. Worked with prompt engineering and grew my web development skills.' },
  ];

  // world-atlas@1 stores numeric IDs — NOT name strings
  const countryIds = { 'Brazil': 76, 'United Kingdom': 826, 'Portugal': 620, 'Germany': 276, 'Canada': 124 };

  // ── Projection ────────────────────────────────────────────────────────────
  const projection = d3.geoOrthographic()
    .scale(scale)
    .translate([width / 2, height / 2])
    .clipAngle(90)
    .rotate([0, 0, 0]);

  const geoPath = d3.geoPath().projection(projection);

  // ── SVG scaffold ──────────────────────────────────────────────────────────
  const svg = d3.select('.about-map')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const defs      = svg.append('defs');
  const oceanGrad = defs.append('radialGradient').attr('id', 'oceanGrad')
    .attr('cx', '40%').attr('cy', '35%');
  oceanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#2a6fa8');
  oceanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0d2e4d');

  svg.append('circle')
    .attr('cx', width/2).attr('cy', height/2).attr('r', scale)
    .attr('fill', 'url(#oceanGrad)').attr('stroke', '#1a4b77').attr('stroke-width', 1);

  const landGroup   = svg.append('g').attr('class', 'land-group');
  const graticGroup = svg.append('g').attr('class', 'gratic-group');
  const flightGroup = svg.append('g').attr('class', 'flight-group');
  const pinGroup    = svg.append('g').attr('class', 'pin-group');
  const planeGroup  = svg.append('g').attr('class', 'plane-group');

  graticGroup.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', geoPath)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.07)')
    .attr('stroke-width', 0.5);

  function redraw() {
    landGroup.selectAll('path').attr('d', geoPath);
    graticGroup.selectAll('path').attr('d', geoPath);
    flightGroup.selectAll('path').attr('d', geoPath);
  }

  // ── Country highlight ─────────────────────────────────────────────────────
  function highlightCountry(name) {
    const id = countryIds[name];
    landGroup.selectAll('.country')
      .transition('hl').duration(400)
      .attr('fill',         d => +d.id === id ? '#66bb6a' : '#3a8a3a')
      .attr('stroke',       d => +d.id === id ? '#fff'    : '#1a5c1a')
      .attr('stroke-width', d => +d.id === id ? 0.8       : 0.3);
  }

  function resetHighlight() {
    landGroup.selectAll('.country')
      .transition('hl').duration(400)
      .attr('fill', '#3a8a3a').attr('stroke', '#1a5c1a').attr('stroke-width', 0.3);
  }

  // ── City info ─────────────────────────────────────────────────────────────
  function showCityInfo(city) {
    if (window.innerWidth < 768) return;
    const panel = d3.select('#city-info');
    panel.interrupt('info').transition('info').duration(250).style('opacity', 0).on('end', function () {
      d3.select(this)
        .html('<h3>' + city.name + ', ' + city.country + '</h3><p>' + city.comment + '</p>')
        .transition('info').duration(500).style('opacity', 1);
    });
  }

  function hideCityInfo() {
    d3.select('#city-info').interrupt('info').transition('info').duration(250).style('opacity', 0);
  }

  // ── Pin ───────────────────────────────────────────────────────────────────
  function createPin(city) {
    const pt = projection(city.coords);
    if (!pt) return null;

    // All geometry is in local space where (0,0) = the exact city coordinate on the globe.
    // The pin tip touches (0,0); the body extends upward.
    //
    // Modern teardrop dimensions:
    //   Bulge radius : 11px   centre at (0, -22)
    //   Tip          : (0,  0)  ← lands exactly on the projected point
    //   Total height : ~33px
    //
    // Path constructed with cubic beziers so the sides curve naturally
    // into the tip, matching the Google Maps / modern pin aesthetic.
    const R  = 11;   // bulge radius
    const CY = -22;  // bulge centre y  (negative = upward in SVG)

    // Teardrop path: start at tip (0,0), curve up left side to top, arc across, curve back down to tip
    const pinD = [
      'M 0,0',
      'C -6,-8  -' + R + ',' + (CY + R * 0.6) + '  -' + R + ',' + CY,   // left curve from tip to bulge left
      'A ' + R + ',' + R + ' 0 1,1 ' + R + ',' + CY,                      // arc across the top of the bulge
      'C ' + R + ',' + (CY + R * 0.6) + '  6,-8  0,0',                    // right curve from bulge right back to tip
      'Z'
    ].join(' ');

    const g = pinGroup.append('g')
      .attr('class', 'city-pin')
      .attr('transform', 'translate(' + pt[0] + ',' + pt[1] + ')')
      .style('opacity', 0);

    // Pin body
    g.append('path')
      .attr('d', pinD)
      .style('fill', '#EF4444')
      .style('stroke', '#B91C1C')
      .style('stroke-width', 1);

    // Subtle shine on the bulge
    g.append('circle')
      .attr('cx', -4).attr('cy', CY - 4)
      .attr('r', 4)
      .style('fill', 'rgba(255,255,255,0.25)');

    // White inner dot at bulge centre
    g.append('circle')
      .attr('cx', 0).attr('cy', CY)
      .attr('r', 4.5)
      .style('fill', '#fff');

    g.transition('pin-fade').duration(400).style('opacity', 1);

    g._remove = function () {
      g.interrupt('pin-fade').transition('pin-fade').duration(400).style('opacity', 0)
        .on('end', function () { d3.select(this).remove(); });
    };
    return g;
  }

  // ── Plane (original image asset) ─────────────────────────────────────────
  function createPlane() {
    const g = planeGroup.append('g').style('opacity', 0);
    g.append('image')
      .attr('href', 'assets/White_plane_icon.svg.png')
      .attr('width', 30)
      .attr('height', 30)
      .attr('x', -15)
      .attr('y', -15);
    return g;
  }

  // ── Globe rotation via named transition ───────────────────────────────────
  function rotateTo(coords, duration) {
    return new Promise(function (resolve) {
      const current = projection.rotate();
      const target  = [-coords[0], -coords[1], 0];
      const interp  = Versor.interpolateAngles(current, target);

      d3.transition('globe-rotate')
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .tween('rotate', function () {
          return function (t) {
            projection.rotate(interp(t));
            redraw();
          };
        })
        .on('end',      function () { resolve(); })
        .on('interrupt',function () { resolve(); }); // never deadlock
    });
  }

  // ── Flight animation via rAF (immune to d3 transition cancellation) ───────
  function animateFlight(fromCoords, toCoords, duration) {
    return new Promise(function (resolve) {
      const arcDatum = { type: 'LineString', coordinates: [fromCoords, toCoords] };
      const arcPath  = flightGroup.append('path')
        .datum(arcDatum)
        .attr('d', geoPath)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.55)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,4')
        .style('opacity', 0);

      arcPath.transition('arc-in').duration(300).style('opacity', 1);

      const plane     = createPlane().style('opacity', 1);
      const geoInterp = d3.geoInterpolate(fromCoords, toCoords);
      const startTime = performance.now();

      function tick() {
        const t      = Math.min((performance.now() - startTime) / duration, 1);
        const coords = geoInterp(t);
        const pt     = projection(coords);

        if (pt) {
          const nCoords = geoInterp(Math.min(t + 0.01, 1));
          const nPt     = projection(nCoords);
          const angle   = nPt
            ? Math.atan2(nPt[1] - pt[1], nPt[0] - pt[0]) * 180 / Math.PI
            : 0;
          plane.attr('transform', 'translate(' + pt[0] + ',' + pt[1] + ') rotate(' + angle + ')');
        }

        // Redraw arc continuously as globe rotates beneath it
        arcPath.attr('d', geoPath);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          plane.transition('plane-out').duration(300).style('opacity', 0)
            .on('end', function () { d3.select(this).remove(); });
          arcPath.transition('arc-out').duration(500).style('opacity', 0)
            .on('end', function () { d3.select(this).remove(); resolve(); });
        }
      }

      requestAnimationFrame(tick);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Tour loop ─────────────────────────────────────────────────────────────
  async function runTour() {
    while (true) {
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];

        await rotateTo(city.coords, i === 0 ? 1200 : 2400);

        highlightCountry(city.country);
        const pin = createPin(city);
        showCityInfo(city);

        await wait(3500);

        if (i < cities.length - 1) {
          const next   = cities[i + 1];
          const midLon = (city.coords[0] + next.coords[0]) / 2;
          const midLat = (city.coords[1] + next.coords[1]) / 2;

          if (pin) pin._remove();
          hideCityInfo();
          resetHighlight();
          await wait(400);

          // Fly + pan globe simultaneously
          await Promise.all([
            animateFlight(city.coords, next.coords, 2800),
            rotateTo([midLon, midLat], 2800),
          ]);

          await wait(300);
        } else {
          if (pin) pin._remove();
          hideCityInfo();
          resetHighlight();
          await wait(1200);
        }
      }
      await wait(500);
    }
  }

  // ── Load world data then start ────────────────────────────────────────────
  d3.json('https://unpkg.com/world-atlas@1/world/110m.json').then(function (world) {
    const countries = topojson.feature(world, world.objects.countries);

    landGroup.selectAll('.country')
      .data(countries.features)
      .enter().append('path')
      .attr('class', 'country')
      .attr('d', geoPath)
      .attr('fill', '#3a8a3a')
      .attr('stroke', '#1a5c1a')
      .attr('stroke-width', 0.3);

    runTour();
  }).catch(function (err) {
    console.error('Failed to load world atlas:', err);
  });

  d3.select('.about-map')
    .on('wheel.zoom', null)
    .on('mousedown.drag', null)
    .on('touchstart.drag', null);
});