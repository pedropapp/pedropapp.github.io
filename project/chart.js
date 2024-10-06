function createBarChart(data, selector, xLabel, yLabel) {
    const margin = { top: 20, right: 20, bottom: 70, left: 60 };
    const width = 1000 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    d3.select(selector).selectAll("*").remove();

    const svg = d3.select(selector).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .range([0, width])
        .domain(data.map(d => d[0]))
        .padding(0.1);

    // Calculate the minimum y value to focus on the top range
    const minY = d3.min(data, d => d[1]) * 0.9; // 90% of the minimum value
    const maxY = d3.max(data, d => d[1]);

    const y = d3.scaleLinear()
        .domain([minY, maxY])
        .range([height, 0]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');

    svg.append('g')
        .call(d3.axisLeft(y).ticks(5));

    svg.selectAll('mybar')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d[0]))
        .attr('y', d => y(d[1]))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d[1]))
        .attr('fill', '#E50914');

    // Add value labels on top of each bar
    svg.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => x(d[0]) + x.bandwidth() / 2)
        .attr('y', d => y(d[1]) - 5)
        .attr('text-anchor', 'middle')
        .text(d => d[1].toFixed(2))
        .attr('fill', 'white')
        .attr('font-size', '10px');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .attr('text-anchor', 'middle')
        .text(yLabel);
}
function createLineChart(data, selector, xLabel, yLabel) {
    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    d3.select(selector).selectAll("*").remove();

    const svg = d3.select(selector).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d[0]))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[1])])
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(24));

    svg.append('g')
        .call(d3.axisLeft(y));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#E50914')
        .attr('stroke-width', 2)
        .attr('d', line);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom)
        .attr('text-anchor', 'middle')
        .text(xLabel);

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .attr('text-anchor', 'middle')
        .text(yLabel);
}
function createPieChart(data, selector, label) {
    const width = 300;
    const height = 300;
    const margin = 40;
    const radius = Math.min(width, height) / 2 - margin;

    // Clear the content of the selected container
    d3.select(selector).selectAll("*").remove();

    // Create the SVG container
    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Create a tooltip div
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "rgba(0, 0, 0, 0.7)")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("font-size", "12px")
        .style("pointer-events", "none");

    // Set the color scale with shades of red and black
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d[0]))
        .range(["#E50914", "#A6000F", "#80000B", "#500008", "#2B0005"]);

    // Compute the position of each slice
    const pie = d3.pie()
        .value(d => d[1])
        .sort(null);

    // Generate the arcs
    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    // Create a group for each slice
    const sliceGroups = svg.selectAll(".slice-group")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "slice-group");

    // Bind data to the slices
    sliceGroups.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data[0]))
        .attr("stroke", "#000")
        .style("stroke-width", "1px");

    // Add labels
    sliceGroups.append("text")
        .text(d => d.data[0])
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#FFF")
        .style("pointer-events", "none")
        .each(function(d) {
            const bbox = this.getBBox();
            const percent = (d.endAngle - d.startAngle) / (2 * Math.PI) * 100;
            if (percent < 4) {
                d3.select(this).remove();
            }
        });

    // Add hover effects
    sliceGroups
        .on("mouseover", function(event, d) {
            d3.select(this).select("path").transition()
                .duration(200)
                .attr("d", d3.arc().innerRadius(0).outerRadius(radius * 1.1));
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`${d.data[0]}: ${d.data[1].toFixed(2)} hours`)
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this).select("path").transition()
                .duration(200)
                .attr("d", arc);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}
function createWorldMap(data, selector, countryField, valueField) {
    const width = 960;
    const height = 500;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const extractCountryName = (str) => {
        const match = str.match(/\(([^)]+)\)/);
        return match ? match[1] : str;
    };

    d3.select(selector).selectAll("*").remove();

    const container = d3.select(selector)
        .append("div")
        .style("position", "relative");

    const svg = container
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .style("height", "auto");

    const g = svg.append("g");

    const projection = d3.geoEquirectangular()
        .scale(140)
        .translate([width / 2, height / 1.4]);

    const path = d3.geoPath().projection(projection);

    const colorScale = d3.scaleLog()
        .domain([1, d3.max(data, d => d[1])])
        .range(["#300", "#f00"]);

    function clicked(event, d) {
        const countryData = data.find(item => extractCountryName(item[0]) === d.properties.name);
        if (!countryData) return; // Don't zoom if there's no data for this country

        const [[x0, y0], [x1, y1]] = path.bounds(d);
        event.stopPropagation();

        const k = Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height));
        const centroid = [(x0 + x1) / 2, (y0 + y1) / 2];

        g.transition()
            .duration(750)
            .attr("transform", `translate(${width / 2}, ${height / 2})scale(${k})translate(${-centroid[0]}, ${-centroid[1]})`)
            .attr("stroke-width", 1 / k);

        showCountryDetails(d);
    }

    function reset() {
        g.transition()
            .duration(750)
            .attr("transform", "translate(0,0)scale(1)")
            .attr("stroke-width", 1);
        hideCountryDetails();
    }

    function showCountryDetails(d) {
        hideCountryDetails(); // Remove any existing details
        const countryData = data.find(item => extractCountryName(item[0]) === d.properties.name);
        if (countryData) {
            const detailsDiv = container.append("div")
                .attr("class", "country-details")
                .style("position", "absolute")
                .style("top", "10px")
                .style("left", "10px")
                .style("padding", "10px")
                .style("border-radius", "5px")
                .style("z-index", "1000");

            detailsDiv.html(`
                <h3>${d.properties.name}</h3>
                <p>Total Hours Watched: ${countryData[1].toFixed(2)} hours</p>
                <!-- Add more details here based on your data structure -->
            `);
        }
    }

    function hideCountryDetails() {
        container.select(".country-details").remove();
    }

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((world) => {
        const countries = topojson.feature(world, world.objects.countries);
        const countrymesh = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

        g.selectAll("path")
            .data(countries.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", d => {
                const countryData = data.find(item => extractCountryName(item[0]) === d.properties.name);
                return countryData ? colorScale(countryData[1]) : "#222";
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .on("click", clicked);

        g.append("path")
            .datum(countrymesh)
            .attr("fill", "none")
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .attr("d", path);

        svg.on("click", reset);

    }).catch(error => console.error("Error loading data:", error));
}
function createRadialChart(data, selector, xLabel, yLabel) {
    const width = 300;
    const height = 300;
    const margin = 20;
    const radius = Math.min(width, height) / 2 - margin;

    // Clear any existing SVG
    const svg = d3.select(selector)
        .html("")
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Add a dark background
    svg.append('circle')
        .attr('r', radius + margin)
        .attr('fill', '#1a1a1a');

    // Ensure data is sorted and includes hour 0
    data = data.sort((a, b) => a[0] - b[0]);
    if (data[0][0] !== 0) {
        data.unshift([0, data[data.length - 1][1]]);
    }

    // Calculate total hours watched
    const totalHoursWatched = d3.sum(data, d => d[1]);

    // Scales
    const angleScale = d3.scaleLinear().domain([0, 24]).range([0, 2 * Math.PI]);
    const radiusScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[1])])
        .range([0, radius * 0.8]);

    // Create circular grid lines
    svg.selectAll('.grid-circle')
        .data([0.2, 0.4, 0.6, 0.8])
        .enter()
        .append('circle')
        .attr('r', d => radius * d)
        .attr('fill', 'none')
        .attr('stroke', '#333')
        .attr('stroke-width', 0.25);

    // Create hour markers
    const hourData = d3.range(24);
    svg.selectAll('.hour-marker')
        .data(hourData)
        .enter()
        .append('g')
        .attr('class', 'hour-marker')
        .each(function(d) {
            const isMainHour = d % 6 === 0;
            const angle = angleScale(d);
            const g = d3.select(this);

            g.append('line')
                .attr('x1', radius * 0.8 * Math.sin(angle))
                .attr('y1', -radius * 0.8 * Math.cos(angle))
                .attr('x2', radius * (isMainHour ? 0.9 : 0.85) * Math.sin(angle))
                .attr('y2', -radius * (isMainHour ? 0.9 : 0.85) * Math.cos(angle))
                .attr('stroke', '#fff')
                .attr('stroke-width', isMainHour ? 1 : 0.5);

            if (isMainHour) {
                g.append('text')
                    .attr('x', radius * 0.95 * Math.sin(angle))
                    .attr('y', -radius * 0.95 * Math.cos(angle))
                    .attr('dy', '0.35em')
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#fff')
                    .style('font-size', '10px')
                    .style('font-weight', 'bold')
                    .text(d);
            }
        });

    // Create the area
    const area = d3.areaRadial()
        .angle(d => angleScale(d[0]))
        .innerRadius(0)
        .outerRadius(d => radiusScale(d[1]))
        .curve(d3.curveLinearClosed);

    svg.append('path')
        .datum(data)
        .attr('fill', 'rgba(255, 0, 0, 0.3)')  // Changed to red with transparency
        .attr('stroke', 'red')  // Changed to red
        .attr('stroke-width', 1)
        .attr('d', area);

    // Function to update time indicator
    function updateTimeIndicator(hour, value) {
        const angle = angleScale(hour);
        const percentage = (value / totalHoursWatched) * 100;
        
        const indicator = svg.selectAll('.time-indicator')
            .data([null], () => 'time-indicator');

        const indicatorEnter = indicator.enter().append('g')
            .attr('class', 'time-indicator');

        indicatorEnter.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('stroke', 'white')  // Changed to white
            .attr('stroke-width', 1);

        indicatorEnter.append('text')
            .attr('y', radius * 0.4)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .style('font-size', '12px')
            .style('font-weight', 'bold');

        indicatorEnter.append('text')
            .attr('y', radius * 0.4 + 12)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .style('font-size', '12px');

        const indicatorUpdate = indicator.merge(indicatorEnter);

        indicatorUpdate.select('line')
            .attr('x2', radius * 0.7 * Math.sin(angle))
            .attr('y2', -radius * 0.7 * Math.cos(angle));

        indicatorUpdate.select('text:first-of-type')
            .text(`${hour}:00`);

        indicatorUpdate.select('text:last-of-type')
            .text(`${percentage.toFixed(2)}% - ${value.toFixed(2)} hrs`);
    }

    // Initial time indicator (current time)
    const now = new Date();
    const currentHour = now.getHours();
    const currentValue = data.find(d => d[0] === currentHour)?.[1] || 0;
    updateTimeIndicator(currentHour, currentValue);

    // Create invisible circular sectors for hover detection
    svg.selectAll('.hover-sector')
        .data(d3.range(24))
        .enter()
        .append('path')
        .attr('class', 'hover-sector')
        .attr('d', d => d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(angleScale(d))
            .endAngle(angleScale(d + 1))()
        )
        .attr('fill', 'transparent')
        .on('mouseover', function(_, i) {
            const value = data.find(d => d[0] === i)?.[1] || 0;
            updateTimeIndicator(i, value);
        })
        .on('mouseout', () => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentValue = data.find(d => d[0] === currentHour)?.[1] || 0;
            updateTimeIndicator(currentHour, currentValue);
        });

    // Add title and subtitle
}