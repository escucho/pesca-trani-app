document.addEventListener('DOMContentLoaded', () => {
    // Elementi UI
    const datePicker = document.getElementById('date-picker');
    const getInfoButton = document.getElementById('get-info-button');
    const todayButton = document.getElementById('today-button');
    const currentTimeSpan = document.getElementById('current-time');
    const recommendedList = document.getElementById('recommended-list');
    const manualHighTideInput = document.getElementById('manual-high-tide');
    const manualLowTideInput = document.getElementById('manual-low-tide');
    const tideSourceIndicator = document.getElementById('tide-source-indicator');
    const themeToggle = document.getElementById('theme-toggle'); // Nuovo elemento

    // Coordinate e API Key (invariate)
    const TRANI_LAT = 41.2759;
    const TRANI_LON = 16.4177;
    const STORMGLASS_API_KEY = 'a103f3b2-3704-11f0-b08d-0242ac130003-a103f466-3704-11f0-b08d-0242ac130003';

    // Parametri e Punteggi (invariati rispetto all'ultima versione "scientifica")
    const OVERLAP_WINDOW_MINUTES = 60; 
    const FISHING_WINDOW_OFFSET_MINUTES = 60; 
    const eventScores = {
        moonMajor: 10, lightChange: 9, tideHigh: 8, moonMinor: 6, tideLow: 3
    };

    // moonMajor: 10 (Punto di riferimento. I transiti lunari sono i periodi di attività massima secondo la teoria solunare).
    // lightChange: 9 (Alba/Tramonto Solare. Fortemente correlati all'attività predatoria, quasi potenti quanto i transiti lunari, a volte anche di più per certe specie costiere).
    // tideHigh: 8 (Alta Marea. Movimento di acqua e nutrienti, avvicina i pesci alla costa. Molto significativa).
    // moonMinor: 6 (Alba/Tramonto Lunare. Effetto secondario ma distinto, buono in combinazione).
    //tideLow: 3 (Bassa Marea. Meno universalmente "attiva" dell'alta per la pesca generica da riva, ma può concentrare i pesci in canali o scoprire zone utili. Valore più basso per riflettere una minore generalità).
    
    const overlapBonus = {
    // --- COMBINAZIONI TOP TIER (★★★★★) ---
    // Tre fattori "forti" o "molto forti" insieme. Dovrebbero dare i punteggi più alti in assoluto.
    "lightChange_moonMajor_tideHigh": 45, // IL SANTO GRAAL: Alba/Tramonto + Transito Lunare + Alta Marea. Difficile chiedere di meglio.

    // --- COMBINAZIONI ECCELLENTI (★★★★☆) ---
    // Due fattori "forti" o "molto forti", o un terzetto con un fattore "medio".
    "moonMajor_tideHigh": 28,          // Transito Lunare + Alta Marea. Combinazione classica potentissima.
    "lightChange_moonMajor": 25,       // Cambio Luce Solare + Transito Lunare. Altra combinazione d'oro.
    "lightChange_tideHigh": 22,        // Cambio Luce Solare + Alta Marea. Molto produttiva.
    "moonMajor_moonMinor_tideHigh": 20, // Transito Lunare + Periodo Lunare Minore + Alta Marea. Solida combinazione a tre.

    // --- COMBINAZIONI MOLTO BUONE (★★★☆☆) ---
    // Un fattore "forte" con uno "medio", o un terzetto con fattori meno potenti.
    "lightChange_moonMajor_moonMinor": 18, // Cambio Luce Solare + Transito Lunare + Periodo Lunare Minore.
    "moonMajor_moonMinor": 15,         // Transito Lunare + Periodo Lunare Minore. Buona sinergia lunare.
    "lightChange_moonMinor_tideHigh": 16, // Cambio Luce Solare + Periodo Lunare Minore + Alta Marea.
    "tideHigh_moonMinor": 12,           // Alta Marea + Periodo Lunare Minore.
    
    // --- COMBINAZIONI BUONE (★★☆☆☆) ---
    // Fattori meno impattanti o un fattore forte con uno debole.
    "lightChange_moonMinor": 10,       // Cambio Luce Solare + Periodo Lunare Minore.
    "moonMajor_tideLow": 10,            // Transito Lunare + Bassa Marea. Può essere significativo in certi spot.
    "lightChange_moonMajor_tideLow": 14, // Trio con bassa marea, meno forte del trio con alta marea.

    // --- COMBINAZIONI INTERESSANTI (★☆☆☆☆) ---
    // Generalmente meno impattanti, ma possono comunque offrire opportunità.
    "lightChange_tideLow": 8,          // Cambio Luce Solare + Bassa Marea.
    "moonMinor_tideLow": 6,            // Periodo Lunare Minore + Bassa Marea.
    "tideHigh_tideLow": 0              // Tecnicamente impossibile che avvengano insieme, ma per completezza. Punteggio nullo.
                                       // (Nota: la logica di raggruppamento attuale difficilmente li metterebbe insieme se molto distanti)
};

    // --- LOGICA TEMA ---
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('fishingAppTheme', theme);
        themeToggle.checked = theme === 'dark';
    }

    function toggleTheme() {
        const currentTheme = localStorage.getItem('fishingAppTheme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    }

    themeToggle.addEventListener('change', toggleTheme);
    // Applica tema salvato all'avvio o default a 'light'
    const savedTheme = localStorage.getItem('fishingAppTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('light'); // Default
    }
    // --- FINE LOGICA TEMA ---


    function updateCurrentTime() { /* ...invariata... */ 
        currentTimeSpan.textContent = new Date().toLocaleTimeString('it-IT');
    }
    function formatTime(dateObject) { /* ...invariata... */ 
        if (!dateObject || isNaN(dateObject.getTime())) return "N/D";
        return dateObject.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    }
    function getMoonPhaseName(phaseValue) { /* ...invariata... */ 
        if (phaseValue > 0.98 || phaseValue < 0.02) return "Luna Nuova 🌑";
        if (phaseValue >= 0.23 && phaseValue <= 0.27) return "Primo Quarto 🌓";
        if (phaseValue >= 0.48 && phaseValue <= 0.52) return "Luna Piena 🌕";
        if (phaseValue >= 0.73 && phaseValue <= 0.77) return "Ultimo Quarto 🌗";
        if (phaseValue < 0.25) return "Luna Crescente (falcetto) 🌒";
        if (phaseValue < 0.50) return "Luna Crescente (gibbosa) 🌔";
        if (phaseValue < 0.75) return "Luna Calante (gibbosa) 🌖";
        if (phaseValue < 1.00) return "Luna Calante (falcetto) 🌘";
        return "N/D";
    }
    function displaySolarInfo(date) { /* ...invariata... */ 
        const times = SunCalc.getTimes(date, TRANI_LAT, TRANI_LON);
        document.getElementById('sunrise').textContent = formatTime(times.sunrise);
        document.getElementById('sunset').textContent = formatTime(times.sunset);
    }
    function displayLunarInfo(date) { /* ...invariata... */ 
        const moonTimes = SunCalc.getMoonTimes(date, TRANI_LAT, TRANI_LON, true);
        document.getElementById('moonrise').textContent = formatTime(moonTimes.rise);
        document.getElementById('moonset').textContent = formatTime(moonTimes.set);
        const { upperTransit, lowerTransit } = getLunarTransits(date, TRANI_LAT, TRANI_LON);
        document.getElementById('moon-transit-upper').textContent = formatTime(upperTransit);
        document.getElementById('moon-transit-lower').textContent = formatTime(lowerTransit);
        const moonIlluminationData = SunCalc.getMoonIllumination(date);
        document.getElementById('moon-phase').textContent = getMoonPhaseName(moonIlluminationData.phase);
        document.getElementById('moon-illumination').textContent = (moonIlluminationData.fraction * 100).toFixed(0);
    }
    function getLunarTransits(date, lat, lon) { /* ...invariata... */ 
        let uT = null, mA = -Infinity, lT = null, mIA = Infinity;
        const sD = new Date(date); sD.setHours(0,0,0,0); const eD = new Date(date); eD.setHours(23,59,59,999);
        for (let m=0; m<1440; m+=5) {
            const cT = new Date(sD.getTime() + m * 60000); if (cT > eD) break;
            const mP = SunCalc.getMoonPosition(cT, lat, lon);
            if (mP.altitude > mA) {mA = mP.altitude; uT = cT;}
            if (mP.altitude < mIA) {mIA = mP.altitude; lT = cT;}
        }
        return { upperTransit: uT, lowerTransit: lT };
    }
    function parseManualTideTimes(timeString, referenceDate) { /* ...invariata... */ 
        if (!timeString || timeString.trim() === "") return [];
        const timesArray = timeString.split(',');
        return timesArray.map(tStr => {
            const parts = tStr.trim().split(':');
            if (parts.length === 2) {
                const hours = parseInt(parts[0], 10);
                const minutes = parseInt(parts[1], 10);
                if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                    const tideDate = new Date(referenceDate);
                    tideDate.setHours(hours, minutes, 0, 0);
                    return tideDate;
                }
            }
            return null;
        }).filter(t => t !== null);
    }
    async function getTides(date, lat, lon) { /* ...invariata... */ 
        const dateStringForCache = date.toISOString().substring(0, 10);
        const manualHighTidesStr = manualHighTideInput.value;
        const manualLowTidesStr = manualLowTideInput.value;
        let highTides = [], lowTides = [], sourceUsed = "";

        if (manualHighTidesStr.trim() !== "" || manualLowTidesStr.trim() !== "") {
            highTides = parseManualTideTimes(manualHighTidesStr, date);
            lowTides = parseManualTideTimes(manualLowTidesStr, date);
            if (highTides.length > 0 || lowTides.length > 0) sourceUsed = "Manuale";
        }

        if (sourceUsed === "") {
            const cacheKey = `tides_API_${dateStringForCache}_${lat}_${lon}`;
            const cachedTides = sessionStorage.getItem(cacheKey);
            if (cachedTides) {
                const parsedTides = JSON.parse(cachedTides);
                highTides = parsedTides.highTides.map(t => new Date(t));
                lowTides = parsedTides.lowTides.map(t => new Date(t));
                sourceUsed = "API (Cache)";
            }
        }
        
        if (sourceUsed === "") {
            document.getElementById('high-tide').textContent = "Caricamento API...";
            document.getElementById('low-tide').textContent = "Caricamento API...";
            const jsDate = new Date(date);
            const startOfDayUTC = new Date(Date.UTC(jsDate.getFullYear(),jsDate.getMonth(),jsDate.getDate(),0,0,0));
            const endOfDayUTC = new Date(Date.UTC(jsDate.getFullYear(),jsDate.getMonth(),jsDate.getDate(),23,59,59));
            const apiUrl = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lon}&start=${startOfDayUTC.toISOString()}&end=${endOfDayUTC.toISOString()}`;
            try {
                const response = await fetch(apiUrl, { headers: { 'Authorization': STORMGLASS_API_KEY } });
                if (!response.ok) {
                    const errD = await response.json().catch(()=>({message:response.statusText}));
                    console.error("API Maree Err:", response.status, errD);
                    let eM = `API Err(${response.status})`+(errD.errors?.key?`: ${errD.errors.key}`:(errD.message?`: ${errD.message}`:""));
                    document.getElementById('high-tide').textContent=eM; document.getElementById('low-tide').textContent="";
                    return {highTides:[],lowTides:[], source: "Errore API"};
                }
                const data = await response.json();
                if(data.data){data.data.forEach(e=>{const tT=new Date(e.time);if(tT>=startOfDayUTC && tT<=endOfDayUTC){if(e.type==='high')highTides.push(tT);else if(e.type==='low')lowTides.push(tT);}});}
                const toCache={highTides:highTides.map(t=>t.toISOString()),lowTides:lowTides.map(t=>t.toISOString())};
                sessionStorage.setItem(`tides_API_${dateStringForCache}_${lat}_${lon}`,JSON.stringify(toCache));
                sourceUsed = "API (Live)";
            } catch (err) {
                console.error("Fetch Maree Err:", err);
                document.getElementById('high-tide').textContent="Fetch Err"; document.getElementById('low-tide').textContent="";
                return {highTides:[],lowTides:[], source: "Errore Fetch"};
            }
        }
        highTides.sort((a,b)=>a-b); lowTides.sort((a,b)=>a-b);
        document.getElementById('high-tide').textContent = highTides.length ? highTides.map(formatTime).join(', ') : "N/D";
        document.getElementById('low-tide').textContent = lowTides.length ? lowTides.map(formatTime).join(', ') : "N/D";
        let srcIndTxt = "Nessuna Fonte Dati Maree";
        if (sourceUsed === "Manuale") srcIndTxt = "Inserite Manualmente";
        else if (sourceUsed === "API (Cache)") srcIndTxt = "Fonte: Stormglass.io (Cache)";
        else if (sourceUsed === "API (Live)") srcIndTxt = "Fonte: Stormglass.io (Live)";
        tideSourceIndicator.textContent = `(${srcIndTxt})`;
        return { highTides, lowTides, source: sourceUsed };
    }

    async function calculateAndDisplayBestTimes(date) {
        getInfoButton.disabled = true; getInfoButton.textContent = "Analisi Dati... ⏳";
        recommendedList.innerHTML = '<li><em>Calcolo dei periodi migliori... 🎣 Analizzando Sole, Luna e Maree...</em></li>';

        let rawEvents = [];
        const overlapMillis = OVERLAP_WINDOW_MINUTES * 60 * 1000;
        const windowOffsetMillis = FISHING_WINDOW_OFFSET_MINUTES * 60 * 1000;

        const sT = SunCalc.getTimes(date,TRANI_LAT,TRANI_LON); 
        if(sT.sunrise)rawEvents.push({name:"🌅 Alba Solare",time:sT.sunrise,type:"lightChange"}); 
        if(sT.sunset)rawEvents.push({name:"🌇 Tramonto Solare",time:sT.sunset,type:"lightChange"});
        const lT_times = SunCalc.getMoonTimes(date,TRANI_LAT,TRANI_LON,true); 
        if(lT_times.rise)rawEvents.push({name:" M. Alba",time:lT_times.rise,type:"moonMinor"}); 
        if(lT_times.set)rawEvents.push({name:" M. Tramonto",time:lT_times.set,type:"moonMinor"});
        const {upperTransit:uTr,lowerTransit:lTr_trans}=getLunarTransits(date,TRANI_LAT,TRANI_LON); 
        if(uTr)rawEvents.push({name:" M. Transito Sup.",time:uTr,type:"moonMajor"}); 
        if(lTr_trans)rawEvents.push({name:" M. Transito Inf.",time:lTr_trans,type:"moonMajor"});
        const{highTides:hTs,lowTides:lTs_tides}=await getTides(date,TRANI_LAT,TRANI_LON); 
        hTs.forEach(t=>rawEvents.push({name:"🌊 Alta Marea",time:t,type:"tideHigh"})); 
        lTs_tides.forEach(t=>rawEvents.push({name:"📉 Bassa Marea",time:t,type:"tideLow"}));

        rawEvents = rawEvents.filter(ev=>ev.time&&!isNaN(ev.time.getTime()));
        if(rawEvents.length===0){
            recommendedList.innerHTML='<li>Nessun evento calcolabile.</li>';
            getInfoButton.disabled=false;getInfoButton.textContent="Mostra Info";return;
        }
        rawEvents.sort((a,b)=>a.time.getTime()-b.time.getTime());

        let fishingWindows=[]; let procIdx=new Set();
        for(let i=0;i<rawEvents.length;i++){
            if(procIdx.has(i))continue; 
            let grp=[rawEvents[i]]; procIdx.add(i);
            for(let j=i+1;j<rawEvents.length;j++){
                if(procIdx.has(j))continue;
                if(rawEvents[j].time.getTime()-grp[grp.length-1].time.getTime()<=overlapMillis){
                    grp.push(rawEvents[j]);procIdx.add(j);
                }else break;
            }
            let scr=0; let typs=grp.map(ev=>ev.type).sort();
            let maxBaseScoreInGroup = 0;
            grp.forEach(ev=>{ const bs=eventScores[ev.type]||0; scr+=bs; if(bs>maxBaseScoreInGroup)maxBaseScoreInGroup=bs; });
            if(grp.length===2)scr+=overlapBonus[typs.join('_')]||0; 
            else if(grp.length>=3)scr+=overlapBonus[typs.slice(0,3).join('_')]||0;
            const fET=grp[0].time.getTime(); const lET=grp[grp.length-1].time.getTime();
            fishingWindows.push({
                start:new Date(fET-windowOffsetMillis), end:new Date(lET+windowOffsetMillis),
                events:grp, score:scr,
                description:grp.map(e=>(eventScores[e.type]===maxBaseScoreInGroup&&grp.length>1)?`<strong>${e.name}</strong>`:e.name).join(' + ')
            });
        }
        fishingWindows.sort((a,b)=>(b.score!==a.score)?b.score-a.score : a.start.getTime()-b.start.getTime());
        
        recommendedList.innerHTML = '';
        let hasExceptionalPeriod = false;
        if (fishingWindows.length > 0) {
            fishingWindows.forEach(fw => { if (fw.score >= 55) hasExceptionalPeriod = true; }); // Controlla se c'è almeno un periodo TOP

            if (!hasExceptionalPeriod && fishingWindows.length > 0) { // Se non ci sono periodi TOP ma ci sono altri periodi
                const infoLi = document.createElement('li');
                infoLi.innerHTML = "<p><em>Nessun periodo 'ECCEZIONALE' rilevato oggi, ma ecco alcune finestre interessanti:</em></p>";
                infoLi.style.border = "none"; infoLi.style.background = "none"; infoLi.style.paddingBottom = "5px";
                recommendedList.appendChild(infoLi);
            }

            fishingWindows.forEach(fw => {
                const li = document.createElement('li');
                // DENTRO calculateAndDisplayBestTimes, DOPO L'ORDINAMENTO DI fishingWindows:
// ...
            let badge = '', qualityText = '';
            
            // NUOVE SOGLIE INDICATIVE (DA TARARE CON TEST!)
            if (fw.score >= 65) {      // Per i "Santo Graal" assoluti
                li.classList.add('very-good-period'); badge = '<span class="badge-icon">🌟</span>'; qualityText = '(ECCEZIONALE)'; 
            } else if (fw.score >= 45) { // Per combinazioni molto forti (es. Major+TideHigh, Major+LightChange)
                li.classList.add('good-period'); badge = '<span class="badge-icon">🔥</span>'; qualityText = '(Altamente Promettente)';
            } else if (fw.score >= 30) { // Per combinazioni buone (es. LightChange+TideHigh, o Major+Minor)
                li.classList.add('decent-period'); qualityText = '(Buon Periodo)'; 
            } else if (fw.score >= 15) { // Per periodi ancora interessanti (es. un Major da solo, o LightChange+Minor)
                li.classList.add('interesting-period'); qualityText = '(Interessante)';
            }
                const scoreTooltip = "Punteggio basato su importanza eventi e loro sovrapposizione.";
                li.innerHTML = `<strong>Da ${formatTime(fw.start)} a ${formatTime(fw.end)}</strong> ${badge} <small class="quality-text">${qualityText}</small><br>
                                <small>${fw.events.length > 1 ? 'Combinazione: ' : 'Evento: '}${fw.description}</small><br>
                                <em title="${scoreTooltip}">Punteggio: ${fw.score}</em>`;
                recommendedList.appendChild(li);
            });
        } else recommendedList.innerHTML = '<li>Nessun periodo consigliato calcolabile.</li>';
        getInfoButton.disabled = false; getInfoButton.textContent = "Mostra Info";
    }
    
    getInfoButton.addEventListener('click', async () => {
        const ds = datePicker.value; if (!ds){alert("Seleziona data.");return;}
        const [y,m,d] = ds.split('-').map(Number); const sD = new Date(y,m-1,d,12,0,0);
        displaySolarInfo(sD); displayLunarInfo(sD); await calculateAndDisplayBestTimes(sD);
    });

    todayButton.addEventListener('click', () => {
        const t = new Date();
        datePicker.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
        manualHighTideInput.value = ''; manualLowTideInput.value = '';
        getInfoButton.click();
    });

    datePicker.addEventListener('change', () => {
        manualHighTideInput.value = ''; manualLowTideInput.value = '';
    });

    function initApp() {
        updateCurrentTime(); setInterval(updateCurrentTime, 1000);
        // Applica tema salvato o default
        const currentTheme = localStorage.getItem('fishingAppTheme') || 'light';
        applyTheme(currentTheme);
        todayButton.click();
    }
    initApp();
});