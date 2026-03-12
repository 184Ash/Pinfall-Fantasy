import { useState, useMemo, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const WEIGHT_CLASSES = [125,133,141,149,157,165,174,184,197,285];

const TEAM_COLORS = [
  {bg:"#C8102E",glow:"#C8102E55",text:"#ff6b80"},
  {bg:"#1A56DB",glow:"#1A56DB55",text:"#6ba3ff"},
  {bg:"#057A55",glow:"#057A5555",text:"#34d399"},
  {bg:"#D97706",glow:"#D9770655",text:"#fbbf24"},
  {bg:"#7E3AF2",glow:"#7E3AF255",text:"#c084fc"},
  {bg:"#0694A2",glow:"#0694A255",text:"#22d3ee"},
  {bg:"#BE185D",glow:"#BE185D55",text:"#f472b6"},
  {bg:"#059669",glow:"#05966955",text:"#6ee7b7"},
  {bg:"#B45309",glow:"#B4530955",text:"#f59e0b"},
  {bg:"#1E429F",glow:"#1E429F55",text:"#93c5fd"},
  {bg:"#9B1C1C",glow:"#9B1C1C55",text:"#fca5a5"},
  {bg:"#5521B5",glow:"#5521B555",text:"#a78bfa"},
];

const DEFAULT_TEAMS = [
  "Raging Bulls","Iron Wolves","Thunder Hawks","Steel Bears",
  "Crimson Eagles","Gold Rush","Blue Devils","Night Owls","Blaze Kings","Silver Foxes",
];

// Full 33-man seedings for all 10 NCAA weight classes
const DEFAULT_WRESTLERS = {
  125:[
    {seed:1,name:"Luke Lilledahl",school:"Penn State"},
    {seed:2,name:"Eddie Ventresca",school:"Virginia Tech"},
    {seed:3,name:"Nic Bouzakis",school:"Ohio State"},
    {seed:4,name:"Sheldon Seymour",school:"Lehigh"},
    {seed:5,name:"Troy Spratley",school:"Oklahoma State"},
    {seed:6,name:"Jore Volk",school:"Minnesota"},
    {seed:7,name:"Nico Provo",school:"Stanford"},
    {seed:8,name:"Dean Peterson",school:"Iowa"},
    {seed:9,name:"Maximo Renteria",school:"Oregon State"},
    {seed:10,name:"Marc-Anthony McGowan",school:"Princeton"},
    {seed:11,name:"Tyler Klinsky",school:"Rider"},
    {seed:12,name:"Vincent Robinson",school:"NC State"},
    {seed:13,name:"Stevo Poulin",school:"Iowa State"},
    {seed:14,name:"Jacob Moran",school:"Indiana"},
    {seed:15,name:"Koda Holeman",school:"Cal Poly"},
    {seed:16,name:"Ezekiel Witt",school:"North Dakota State"},
    {seed:17,name:"Jett Strickenberger",school:"West Virginia"},
    {seed:18,name:"Spencer Moore",school:"Illinois"},
    {seed:19,name:"Kysen Terukina",school:"North Carolina"},
    {seed:20,name:"Diego Sotelo",school:"Michigan"},
    {seed:21,name:"Conrad Hendriksen",school:"Oklahoma"},
    {seed:22,name:"Davis Motyka",school:"Penn"},
    {seed:23,name:"Nicolar Rivera",school:"Wisconsin"},
    {seed:24,name:"Ayden Smith",school:"Rutgers"},
    {seed:25,name:"Kael Lauridsen",school:"Nebraska"},
    {seed:26,name:"Cooper Flynn",school:"Chattanooga"},
    {seed:27,name:"Brady Roark",school:"South Dakota State"},
    {seed:28,name:"Andrew Binni",school:"Navy"},
    {seed:29,name:"Tyler Chappell",school:"Pittsburgh"},
    {seed:30,name:"Sulayman Bah",school:"Columbia"},
    {seed:31,name:"Desmond Pleasant",school:"Drexel"},
    {seed:32,name:"Mack Mauger",school:"Missouri"},
    {seed:33,name:"Jace Schafer",school:"Bloomsburg"},
  ],
  133:[
    {seed:1,name:"Jax Forrest",school:"Oklahoma State"},
    {seed:2,name:"Ben Davino",school:"Ohio State"},
    {seed:3,name:"Marcus Blaze",school:"Penn State"},
    {seed:4,name:"Aaron Seidel",school:"Virginia Tech"},
    {seed:5,name:"Kyler Larkin",school:"Arizona State"},
    {seed:6,name:"Drake Ayala",school:"Iowa"},
    {seed:7,name:"Lucas Byrd",school:"Illinois"},
    {seed:8,name:"Markel Baker",school:"Northern Illinois"},
    {seed:9,name:"Dominick Serrano",school:"Northern Colorado"},
    {seed:10,name:"Maximilian Leete",school:"American"},
    {seed:11,name:"Tyler Ferrara",school:"Cornell"},
    {seed:12,name:"Evan Mougalian",school:"Penn"},
    {seed:13,name:"Jacob Van Dee",school:"Nebraska"},
    {seed:14,name:"Ethan Berginc",school:"Army"},
    {seed:15,name:"Tyler Knox",school:"Stanford"},
    {seed:16,name:"Zan Fugitt",school:"Wisconsin"},
    {seed:17,name:"T.K. Davis",school:"George Washington"},
    {seed:18,name:"Gunner Andrick",school:"West Virginia"},
    {seed:19,name:"Gage Walker",school:"Missouri"},
    {seed:20,name:"Julian Farber",school:"Northern Iowa"},
    {seed:21,name:"Sean Spidle",school:"Northwestern"},
    {seed:22,name:"Zach Redding",school:"NC State"},
    {seed:23,name:"Braxton Brown",school:"Maryland"},
    {seed:24,name:"Blake Boarman",school:"Purdue"},
    {seed:25,name:"Will Betancourt",school:"Rider"},
    {seed:26,name:"Dylan Shawver",school:"Rutgers"},
    {seed:27,name:"Marcel Lopez",school:"SIU Edwardsville"},
    {seed:28,name:"Garrett Grice",school:"Iowa State"},
    {seed:29,name:"Luke Willochell",school:"Wyoming"},
    {seed:30,name:"Gabe Whisenhunt",school:"Oregon State"},
    {seed:31,name:"Gable Strickland",school:"Lock Haven"},
    {seed:32,name:"Andrew Austin",school:"Central Michigan"},
    {seed:33,name:"Carter Schmidt",school:"Oklahoma"},
  ],
  141:[
    {seed:1,name:"Jesse Mendez",school:"Ohio State"},
    {seed:2,name:"Sergio Vega",school:"Oklahoma State"},
    {seed:3,name:"Brock Hardy",school:"Nebraska"},
    {seed:4,name:"Anthony Echemendia",school:"Iowa State"},
    {seed:5,name:"Luke Stanich",school:"Lehigh"},
    {seed:6,name:"Vince Cornella",school:"Cornell"},
    {seed:7,name:"Nasir Bailey",school:"Iowa"},
    {seed:8,name:"Vance Vombaur",school:"Minnesota"},
    {seed:9,name:"Joey Olivieri",school:"Rutgers"},
    {seed:10,name:"Jack Consiglio",school:"Stanford"},
    {seed:11,name:"CJ Composto",school:"Penn"},
    {seed:12,name:"Luke Simcox",school:"North Carolina"},
    {seed:13,name:"Wyatt Henson",school:"Lock Haven"},
    {seed:14,name:"Braeden Davis",school:"Penn State"},
    {seed:15,name:"Elijah Griffin",school:"Rider"},
    {seed:16,name:"Ryan Jack",school:"NC State"},
    {seed:17,name:"Caedyn Ricciardi",school:"Navy"},
    {seed:18,name:"Carter Nogle",school:"Air Force"},
    {seed:19,name:"Haiden Drury",school:"Utah Valley"},
    {seed:20,name:"Julian Tagg",school:"South Dakota State"},
    {seed:21,name:"Tyler Wells",school:"Oklahoma"},
    {seed:22,name:"Lorenzo Frezza",school:"Columbia"},
    {seed:23,name:"Dylan Chappell",school:"Bucknell"},
    {seed:24,name:"Nash Singleton",school:"Oregon State"},
    {seed:25,name:"Tom Crook",school:"Virginia Tech"},
    {seed:26,name:"Braden Basile",school:"Army"},
    {seed:27,name:"Gable Porter",school:"Virginia"},
    {seed:28,name:"Pierson Manville",school:"Arizona State"},
    {seed:29,name:"Jordan Titus",school:"West Virginia"},
    {seed:30,name:"Dario Lemus",school:"Maryland"},
    {seed:31,name:"Billy DeKraker",school:"Northwestern"},
    {seed:32,name:"Matthew Martino",school:"Princeton"},
    {seed:33,name:"Aldo Hernandez",school:"Appalachian State"},
  ],
  149:[
    {seed:1,name:"Shayne Van Ness",school:"Penn State"},
    {seed:2,name:"Jaxon Joy",school:"Cornell"},
    {seed:3,name:"Cross Wasilewski",school:"Penn"},
    {seed:4,name:"Collin Gaj",school:"Virginia Tech"},
    {seed:5,name:"Koy Buesgens",school:"NC State"},
    {seed:6,name:"Caleb Tyus",school:"SIU Edwardsville"},
    {seed:7,name:"Ethan Stiles",school:"Ohio State"},
    {seed:8,name:"Casey Swiderski",school:"Oklahoma State"},
    {seed:9,name:"David Evans",school:"Utah Valley"},
    {seed:10,name:"Aden Valencia",school:"Stanford"},
    {seed:11,name:"Lachlan McNeil",school:"Michigan"},
    {seed:12,name:"Carter Young",school:"Maryland"},
    {seed:13,name:"Joseph Zargo",school:"Wisconsin"},
    {seed:14,name:"Caleb Rathjen",school:"Northern Iowa"},
    {seed:15,name:"Ryder Block",school:"Iowa"},
    {seed:16,name:"Jacob Frost",school:"Iowa State"},
    {seed:17,name:"Lucas Kapusta",school:"Lock Haven"},
    {seed:18,name:"Eugene Harney",school:"Morgan State"},
    {seed:19,name:"Brock Herman",school:"Little Rock"},
    {seed:20,name:"Chance Lamer",school:"Nebraska"},
    {seed:21,name:"Gabe Willochell",school:"Wyoming"},
    {seed:22,name:"Eligh Rivera",school:"Princeton"},
    {seed:23,name:"Max Petersen",school:"North Dakota State"},
    {seed:24,name:"Andrew Clark",school:"Rutgers"},
    {seed:25,name:"Michael Gioffre",school:"Illinois"},
    {seed:26,name:"Anderson Heap",school:"Davidson"},
    {seed:27,name:"Andre Gonzales",school:"Cal Poly"},
    {seed:28,name:"Kade Brown",school:"Pittsburgh"},
    {seed:29,name:"Kaden Cassidy",school:"George Mason"},
    {seed:30,name:"Dylan Layton",school:"Rider"},
    {seed:31,name:"Ryan Michaels",school:"Edinboro"},
    {seed:32,name:"Clayton Jones",school:"Michigan State"},
    {seed:33,name:"Austin McBurney",school:"Brown"},
  ],
  157:[
    {seed:1,name:"PJ Duke",school:"Penn State"},
    {seed:2,name:"Antrell Taylor",school:"Nebraska"},
    {seed:3,name:"Meyer Shapiro",school:"Cornell"},
    {seed:4,name:"Kaleb Larkin",school:"Arizona State"},
    {seed:5,name:"Landon Robideau",school:"Oklahoma State"},
    {seed:6,name:"Jude Swisher",school:"Penn"},
    {seed:7,name:"Kannon Webster",school:"Illinois"},
    {seed:8,name:"Brandon Cannon",school:"Ohio State"},
    {seed:9,name:"Daniel Cardenas",school:"Stanford"},
    {seed:10,name:"Logan Rozynski",school:"Lehigh"},
    {seed:11,name:"Ty Watters",school:"West Virginia"},
    {seed:12,name:"Vinny Zerban",school:"Iowa State"},
    {seed:13,name:"Derek Raike",school:"Ohio"},
    {seed:14,name:"Ethen Miller",school:"Virginia Tech"},
    {seed:15,name:"Cameron Catrabone",school:"Michigan"},
    {seed:16,name:"Cael Swensen",school:"South Dakota State"},
    {seed:17,name:"Luke Mechler",school:"Wisconsin"},
    {seed:18,name:"DJ McGee",school:"George Mason"},
    {seed:19,name:"Kai Owen",school:"Columbia"},
    {seed:20,name:"Jimmy Harrington",school:"Harvard"},
    {seed:21,name:"Charlie Millard",school:"Minnesota"},
    {seed:22,name:"Colton Washleski",school:"Virginia"},
    {seed:23,name:"Kaleb Burgess",school:"Buffalo"},
    {seed:24,name:"Jaivon Jones",school:"Little Rock"},
    {seed:25,name:"Mason Shrader",school:"Central Michigan"},
    {seed:26,name:"Jonathan Ley",school:"Navy"},
    {seed:27,name:"Dylan Evans",school:"Pittsburgh"},
    {seed:28,name:"Gavin Drexler",school:"North Dakota State"},
    {seed:29,name:"Bryce Lowery",school:"Indiana"},
    {seed:30,name:"Laird Root",school:"North Carolina"},
    {seed:31,name:"Garrett McChesney",school:"Edinboro"},
    {seed:32,name:"Jeb Prechtel",school:"Bellarmine"},
    {seed:33,name:"Yannis Charles",school:"Morgan State"},
  ],
  165:[
    {seed:1,name:"Mitchell Mesenbrink",school:"Penn State"},
    {seed:2,name:"Joey Blaze",school:"Purdue"},
    {seed:3,name:"Mikey Caliendo",school:"Iowa"},
    {seed:4,name:"Nicco Ruiz",school:"Arizona State"},
    {seed:5,name:"LaDarion Lockett",school:"Oklahoma State"},
    {seed:6,name:"LJ Araujo",school:"Nebraska"},
    {seed:7,name:"Max Brignola",school:"Lehigh"},
    {seed:8,name:"Matty Bianchi",school:"Little Rock"},
    {seed:9,name:"Bryce Hepner",school:"North Carolina"},
    {seed:10,name:"Will Denny",school:"NC State"},
    {seed:11,name:"Ryder Downey",school:"Northern Iowa"},
    {seed:12,name:"Cesar Alvan",school:"Columbia"},
    {seed:13,name:"Andrew Sparks",school:"Minnesota"},
    {seed:14,name:"Andrew Barbosa",school:"Rutgers"},
    {seed:15,name:"Connor Euton",school:"Iowa State"},
    {seed:16,name:"Paddy Gallagher",school:"Ohio State"},
    {seed:17,name:"Braeden Scoles",school:"Illinois"},
    {seed:18,name:"Gunner Filipowicz",school:"Army"},
    {seed:19,name:"Noah Mulvaney",school:"Bucknell"},
    {seed:20,name:"Ty Whalen",school:"Princeton"},
    {seed:21,name:"Brock Woodcock",school:"SIU Edwardsville"},
    {seed:22,name:"Matthew Olguin",school:"Oregon State"},
    {seed:23,name:"Chris Earnest",school:"Kent State"},
    {seed:24,name:"Sean Seefeldt",school:"Penn"},
    {seed:25,name:"Mac Church",school:"Virginia Tech"},
    {seed:26,name:"Tyler Lillard",school:"Indiana"},
    {seed:27,name:"EJ Parco",school:"Stanford"},
    {seed:28,name:"Cody Goebel",school:"Wisconsin"},
    {seed:29,name:"Ryan Burgos",school:"Edinboro"},
    {seed:30,name:"Thomas Snipes",school:"The Citadel"},
    {seed:31,name:"Jared Keslar",school:"Pittsburgh"},
    {seed:32,name:"Cody Walsh",school:"Drexel"},
    {seed:33,name:"Ryan Vigil",school:"VMI"},
  ],
  174:[
    {seed:1,name:"Levi Haines",school:"Penn State"},
    {seed:2,name:"Simon Ruiz",school:"Cornell"},
    {seed:3,name:"Christopher Minto",school:"Nebraska"},
    {seed:4,name:"Carson Kharchla",school:"Ohio State"},
    {seed:5,name:"Patrick Kennedy",school:"Iowa"},
    {seed:6,name:"Matty Singleton",school:"NC State"},
    {seed:7,name:"Cam Steed",school:"Missouri"},
    {seed:8,name:"Alex Facundo",school:"Oklahoma State"},
    {seed:9,name:"Beau Mantanona",school:"Michigan"},
    {seed:10,name:"Myles Takats",school:"Bucknell"},
    {seed:11,name:"MJ Gaitan",school:"Iowa State"},
    {seed:12,name:"Carter Schubert",school:"Oklahoma"},
    {seed:13,name:"Carter Baer",school:"Binghamton"},
    {seed:14,name:"Moses Espinoza-Owens",school:"South Dakota State"},
    {seed:15,name:"Danny Wask",school:"Navy"},
    {seed:16,name:"Nick Fine",school:"Columbia"},
    {seed:17,name:"Jared Simma",school:"Northern Iowa"},
    {seed:18,name:"Colin Kelly",school:"Illinois"},
    {seed:19,name:"Logan Messer",school:"George Mason"},
    {seed:20,name:"Daschle Lamer",school:"Oregon State"},
    {seed:21,name:"Lenny Pinto",school:"Rutgers"},
    {seed:22,name:"Brody Baumann",school:"Purdue"},
    {seed:23,name:"Luca Augustine",school:"Pittsburgh"},
    {seed:24,name:"Garrett Thompson",school:"Ohio"},
    {seed:25,name:"Sergio Desiante",school:"Virginia Tech"},
    {seed:26,name:"Derek Gilcher",school:"Indiana"},
    {seed:27,name:"Collin Carrigan",school:"North Carolina"},
    {seed:28,name:"Holden Garcia",school:"Princeton"},
    {seed:29,name:"Avery Bassett",school:"Lock Haven"},
    {seed:30,name:"Riley Davis",school:"Wyoming"},
    {seed:31,name:"Cael Valencia",school:"Arizona State"},
    {seed:32,name:"Luke Condon",school:"Wisconsin"},
    {seed:33,name:"Grant O'Dell",school:"Bellarmine"},
  ],
  184:[
    {seed:1,name:"Rocco Welsh",school:"Penn State"},
    {seed:2,name:"Aeoden Sinclair",school:"Missouri"},
    {seed:3,name:"Max McEnelly",school:"Minnesota"},
    {seed:4,name:"James Conway",school:"Franklin & Marshall"},
    {seed:5,name:"Brock Mantanona",school:"Michigan"},
    {seed:6,name:"Eddie Neitenbach",school:"Wyoming"},
    {seed:7,name:"Angelo Ferrari",school:"Iowa"},
    {seed:8,name:"Silas Allred",school:"Nebraska"},
    {seed:9,name:"Chris Moore",school:"Illinois"},
    {seed:10,name:"Caleb Campos",school:"American"},
    {seed:11,name:"Shane Cartagena-Walsh",school:"Rutgers"},
    {seed:12,name:"Dylan Fishback",school:"Ohio State"},
    {seed:13,name:"Isaac Dean",school:"Iowa State"},
    {seed:14,name:"Jaden Bullock",school:"Virginia Tech"},
    {seed:15,name:"Sal Perrine",school:"Ohio"},
    {seed:16,name:"Rylan Rogers",school:"Lehigh"},
    {seed:17,name:"Ian Bush",school:"West Virginia"},
    {seed:18,name:"Jake Dailey",school:"North Carolina"},
    {seed:19,name:"Jared McGill",school:"Edinboro"},
    {seed:20,name:"Brian Soldano",school:"Oklahoma"},
    {seed:21,name:"Tomas Brooker",school:"Appalachian State"},
    {seed:22,name:"Zack Ryder",school:"Oklahoma State"},
    {seed:23,name:"Ceasar Garza",school:"Cal Poly"},
    {seed:24,name:"Joe Curtis",school:"Columbia"},
    {seed:25,name:"Malachi DuVall",school:"George Mason"},
    {seed:26,name:"Chase Kranitz",school:"Pittsburgh"},
    {seed:27,name:"Aidan Brenot",school:"North Dakota State"},
    {seed:28,name:"Abraham Wojcikiewicz",school:"Stanford"},
    {seed:29,name:"Nick Fox",school:"Northern Iowa"},
    {seed:30,name:"Tyler Bienus",school:"Bucknell"},
    {seed:31,name:"Mahonri Rushton",school:"Northern Colorado"},
    {seed:32,name:"Caleb Uhlenhopp",school:"Utah Valley"},
    {seed:33,name:"Sam Goin",school:"Indiana"},
  ],
  197:[
    {seed:1,name:"Josh Barr",school:"Penn State"},
    {seed:2,name:"Rocky Elam",school:"Iowa State"},
    {seed:3,name:"Stephen Little",school:"Little Rock"},
    {seed:4,name:"Sonny Sasso",school:"Virginia Tech"},
    {seed:5,name:"Joey Novak",school:"Wyoming"},
    {seed:6,name:"Justin Rademacher",school:"Oregon State"},
    {seed:7,name:"Cody Merrill",school:"Oklahoma State"},
    {seed:8,name:"DJ Parker",school:"Oklahoma"},
    {seed:9,name:"Angelo Posada",school:"Stanford"},
    {seed:10,name:"Mac Stout",school:"Pittsburgh"},
    {seed:11,name:"Camden McDanel",school:"Nebraska"},
    {seed:12,name:"Luke Geog",school:"Ohio State"},
    {seed:13,name:"Bennett Berge",school:"South Dakota State"},
    {seed:14,name:"Gabe Sollars",school:"Indiana"},
    {seed:15,name:"Remy Cotton",school:"Rutgers"},
    {seed:16,name:"Branson John",school:"Maryland"},
    {seed:17,name:"Dillon Bechtold",school:"Bucknell"},
    {seed:18,name:"Andrew Reall",school:"Brown"},
    {seed:19,name:"Zayne Lehman",school:"Ohio"},
    {seed:20,name:"Wyatt Ingham",school:"Wisconsin"},
    {seed:21,name:"Rune Lawrence",school:"West Virginia"},
    {seed:22,name:"Devin Wasley",school:"North Dakota State"},
    {seed:23,name:"Mikey Squires",school:"Binghamton"},
    {seed:24,name:"Brock Zurawski",school:"Rider"},
    {seed:25,name:"Evan Bates",school:"Missouri"},
    {seed:26,name:"Ben Vanadia",school:"Purdue"},
    {seed:27,name:"Gabe Arnold",school:"Iowa"},
    {seed:28,name:"Kael Wisler",school:"Michigan State"},
    {seed:29,name:"Colton Hawks",school:"Arizona State"},
    {seed:30,name:"Kade Rule",school:"Chattanooga"},
    {seed:31,name:"Kael Bennie",school:"Utah Valley"},
    {seed:32,name:"Blake Schaffer",school:"Kent State"},
    {seed:33,name:"Karson Tompkins",school:"Air Force"},
  ],
  285:[
    {seed:1,name:"Yonger Bastida",school:"Iowa State"},
    {seed:2,name:"Isaac Trumble",school:"NC State"},
    {seed:3,name:"Taye Ghadiali",school:"Michigan"},
    {seed:4,name:"AJ Ferrari",school:"Nebraska"},
    {seed:5,name:"Nick Feldman",school:"Ohio State"},
    {seed:6,name:"Nathan Taylor",school:"Lehigh"},
    {seed:7,name:"Konner Doucet",school:"Oklahoma State"},
    {seed:8,name:"Ben Kueter",school:"Iowa"},
    {seed:9,name:"Cole Mirasola",school:"Penn State"},
    {seed:10,name:"David Szuba",school:"Arizona State"},
    {seed:11,name:"Devon Dawson",school:"Northern Illinois"},
    {seed:12,name:"Braxton Amos",school:"Wisconsin"},
    {seed:13,name:"Spencer Lanosga",school:"Navy"},
    {seed:14,name:"Koy Hopke",school:"Minnesota"},
    {seed:15,name:"Brady Colbert",school:"Army"},
    {seed:16,name:"Jimmy Mullen",school:"Virginia Tech"},
    {seed:17,name:"Vincent Mueller",school:"Columbia"},
    {seed:18,name:"Christian Carroll",school:"Wyoming"},
    {seed:19,name:"Nate Schon",school:"Drexel"},
    {seed:20,name:"Dayton Pitzer",school:"Pittsburgh"},
    {seed:21,name:"Juan Mora",school:"Oklahoma"},
    {seed:22,name:"Trevor Tinker",school:"Cal Poly"},
    {seed:23,name:"Stephan Monchery",school:"Appalachian State"},
    {seed:24,name:"Connor Barket",school:"Duke"},
    {seed:25,name:"Alex Semenenko",school:"Brown"},
    {seed:26,name:"Luke Luffman",school:"Illinois"},
    {seed:27,name:"Hunter Catka",school:"Rutgers"},
    {seed:28,name:"Jarrett Stoner",school:"Missouri"},
    {seed:29,name:"Luke Rasmussen",school:"South Dakota State"},
    {seed:30,name:"Jack Forbes",school:"Utah Valley"},
    {seed:31,name:"Brenan Morgan",school:"Virginia"},
    {seed:32,name:"Emmanuel Ulrich",school:"American"},
    {seed:33,name:"Mason Rebuck",school:"Bloomsburg"},
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pickKey = (w,s) => `${w}-${s}`;

// Levenshtein for fuzzy name matching
function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>j===0?i:0));
  for(let j=1;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function normName(s){return s.toLowerCase().replace(/[^a-z0-9\s'-]/g,"").replace(/\s+/g," ").trim();}
function stripParen(s){return s.replace(/\s*[\[(][^\])]*[\])]/g,"").trim();}

function buildNameIndex(wrestlers){
  const idx=[];
  WEIGHT_CLASSES.forEach(w=>{(wrestlers[w]||[]).forEach(wr=>{
    idx.push({weight:w,seed:wr.seed,name:wr.name,school:wr.school,norm:normName(wr.name)});
  });});
  return idx;
}

function fuzzyFind(raw,idx,threshold=4){
  const n=normName(stripParen(raw));
  if(!n||n.length<2) return null;
  let best=null,bestScore=Infinity;
  for(const e of idx){
    if(e.norm===n) return {entry:e,dist:0,exact:true};
    const rawLast=n.split(" ").slice(-1)[0];
    const eLast=e.norm.split(" ").slice(-1)[0];
    const score=Math.min(levenshtein(n,e.norm),levenshtein(rawLast,eLast)+1);
    if(score<bestScore){bestScore=score;best=e;}
  }
  return bestScore<=threshold?{entry:best,dist:bestScore,exact:false}:null;
}

// ─── RAW SCORE IMPORT PARSER ──────────────────────────────────────────────────
// Strategy: extract (name, points) pairs directly from pasted text.
// This is more reliable than reconstructing from bout-by-bout results,
// since TrackWrestling and FloWrestling both show cumulative fantasy pts.
//
// Supported paste formats:
//   TW standings: "1  John Smith  Iowa  14.0"  (rank name school pts)
//   TW individual: "John Smith (Iowa)  14.0 pts"
//   Flo CSV: "Name,School,Points,Place" or "Wrestler,School,Pts"
//   Generic: any line containing a name and a number that looks like points
//
function parseScoreText(text){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  const pairs={}; // normName -> { rawName, pts }

  // Detect CSV header
  const firstLower=(lines[0]||"").toLowerCase();
  const isCSV=firstLower.includes(",");
  const cols=firstLower.split(",").map(c=>c.replace(/[^a-z]/g,""));
  const nameCol=cols.findIndex(c=>["name","wrestler","athlete"].some(k=>c.includes(k)));
  const ptsCol=cols.findIndex(c=>["pts","points","score","fantasy"].some(k=>c.includes(k)));
  const schoolCol=cols.findIndex(c=>["school","team","college","university"].some(k=>c.includes(k)));

  if(isCSV && ptsCol>=0){
    // Parse as CSV
    lines.slice(1).forEach(line=>{
      const parts=line.split(",").map(s=>s.replace(/^"|"$/g,"").trim());
      const name=parts[nameCol>=0?nameCol:0];
      const ptsRaw=parts[ptsCol];
      const pts=parseFloat(ptsRaw);
      if(name&&!isNaN(pts)&&pts>=0){
        pairs[normName(name)]={rawName:name,pts};
      }
    });
    return pairs;
  }

  // Non-CSV: line-by-line heuristics
  // Pattern 1 — TW standings block: optional rank, name, optional school, number
  // e.g. "3  Carter Starocci  Penn State  12.0"
  //      "Carter Starocci  Penn State  12.0 pts"
  //      "Carter Starocci (Penn State) — 12.0"
  const ptsPat=/(\d+(?:\.\d+)?)\s*(?:pts?|points?|fantasy\s*pts?)?[\s]*$/i;
  const rankLeadPat=/^\d+\s+/; // leading rank number

  lines.forEach(line=>{
    // Strip rank if present
    let l=line.replace(rankLeadPat,"").trim();
    // Find trailing number that looks like pts (0–100 range)
    const m=l.match(ptsPat);
    if(!m) return;
    const pts=parseFloat(m[1]);
    if(pts<0||pts>120) return; // sanity bound

    // Remove the pts portion and any trailing separators
    let namePart=l.slice(0,l.lastIndexOf(m[1])).replace(/[-–—|,\s]+$/,"").trim();
    // Strip parenthetical school annotation
    namePart=stripParen(namePart);
    // If there are 3+ words, the last word(s) might be the school — try longest name first
    // We'll keep the full string as the name candidate; fuzzy matching will handle it
    if(namePart.length>2){
      pairs[normName(namePart)]={rawName:namePart,pts};
    }
  });

  return pairs;
}

function matchScoresToRoster(scorePairs, nameIndex, picks){
  const matched=[], unmatched=[];
  Object.entries(scorePairs).forEach(([norm,{rawName,pts}])=>{
    const m=fuzzyFind(rawName,nameIndex);
    if(m){
      const key=pickKey(m.entry.weight,m.entry.seed);
      const drafted=!!picks[key];
      matched.push({entry:m.entry,pts,rawName,exact:m.exact,dist:m.dist,drafted,key});
    } else {
      unmatched.push({rawName,pts});
    }
  });
  return {matched,unmatched};
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css=`
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#0d1117;}
::-webkit-scrollbar-thumb{background:#c9a84c66;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#c9a84c;}
.wrow{transition:background .1s;}
.wrow:hover{background:rgba(201,168,76,.05) !important;}
.taken-row{opacity:.42;}
.btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.btn:hover{filter:brightness(1.2);}
.btn-primary{background:#c9a84c;color:#070a0e;border-radius:5px;font-weight:700;letter-spacing:.08em;}
.btn-ghost{background:transparent;color:#c9a84c;border:1px solid #c9a84c44;border-radius:5px;}
.btn-ghost:hover{background:#c9a84c18;}
.btn-danger{background:transparent;color:#b04040;border:1px solid #5a1c1c;border-radius:5px;}
.btn-sm{padding:3px 10px;font-size:11px;}
.btn-md{padding:7px 16px;font-size:13px;}
.btn-lg{padding:9px 22px;font-size:14px;}
.undo-x{cursor:pointer;border:none;background:none;color:#3a2a2a;transition:color .15s;font-size:13px;padding:1px 4px;}
.undo-x:hover{color:#f87171;}
.pulse{animation:pulseAnim 2.2s infinite;}
@keyframes pulseAnim{0%,100%{opacity:1}50%{opacity:.45}}
.flash-row{animation:flashRow .7s ease-out;}
@keyframes flashRow{0%{background:rgba(201,168,76,.3)}100%{background:transparent}}
.slide-down{animation:slideDown .2s ease-out;}
@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.tab-link{cursor:pointer;border:none;background:none;transition:all .15s;white-space:nowrap;font-family:'Oswald',sans-serif;}
.tab-link:hover{opacity:.8;}
input:focus,select:focus,textarea:focus{outline:none;border-color:#c9a84c !important;box-shadow:0 0 0 2px #c9a84c22;}
select{cursor:pointer;}
.avail-bar{transition:width .5s cubic-bezier(.4,0,.2,1);}
.card{background:#0b0f14;border:1px solid #1a1f26;border-radius:10px;overflow:hidden;}
.card-h{transition:border-color .2s;}
.card-h:hover{border-color:#c9a84c33 !important;}
.sec-label{font-size:10px;letter-spacing:.18em;color:#6a5a30;font-family:'Oswald',sans-serif;font-weight:400;}
.inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;font-family:'Barlow Condensed',sans-serif;font-size:14px;padding:7px 11px;width:100%;}
.inp-sm{font-size:12px;padding:4px 8px;}
.rank-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:'Oswald',sans-serif;flex-shrink:0;}
.override-btn:hover{background:rgba(201,168,76,.14) !important;border-radius:3px;}
textarea{resize:vertical;}
`;

// ─── APP ─────────────────────────────────────────────────────────────────────

// Picks per team: 10 weight slots + 1 bonus "dark horse" (can be toggled off)
const PICKS_PER_TEAM_BASE = 10; // without bonus
const PICKS_PER_TEAM_BONUS = 11; // with bonus
const TEAM_SOFT_CAP = 20; // warn above this
const TEAM_HARD_CAP = 30; // block above this

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [teams,setTeams]=useState(DEFAULT_TEAMS);
  // TODO: replace with real auth — true = commissioner has full control
  const [isCommissioner,setIsCommissioner]=useState(true);
  const [draftStarted,setDraftStarted]=useState(false);
  const [wrestlers,setWrestlers]=useState(DEFAULT_WRESTLERS);
  const [picks,setPicks]=useState({});
  const [bonusKeys,setBonusKeys]=useState([]); // pick keys manually designated as bonus
  const [points,setPoints]=useState({});
  // Open at board if draft is already underway, settings if pre-draft
  // When real persistence is wired up, draftStarted will load from DB and this will auto-route correctly
  const [activePage,setActivePage]=useState(draftStarted?"board":"settings");
  const [searchQ,setSearchQ]=useState("");
  const [toast,setToast]=useState(null);
  const [hlKey,setHlKey]=useState(null);

  // ── Settings ──────────────────────────────────────────────────────────────
  // draftOrder: array of team names in their pick order (can differ from teams list)
  const [draftOrder,setDraftOrder]=useState(DEFAULT_TEAMS);
  const [rotationType,setRotationType]=useState("snake"); // "snake" | "linear" | "third_round_reversal"
  const [bonusPickEnabled,setBonusPickEnabled]=useState(true);
  const picksPerTeam=bonusPickEnabled?PICKS_PER_TEAM_BONUS:PICKS_PER_TEAM_BASE;

  // ── Ascending pick timer ──────────────────────────────────────────────────
  const [timerSec,setTimerSec]=useState(0);
  const [timerPaused,setTimerPaused]=useState(false);
  const timerRef=useRef(null);
  const timerPausedRef=useRef(false);
  const resetTimer=()=>{
    setTimerSec(0);
    setTimerPaused(false);
    timerPausedRef.current=false;
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{if(!timerPausedRef.current)setTimerSec(s=>s+1);},1000);
  };
  const pauseTimer=()=>{timerPausedRef.current=true;setTimerPaused(true);};
  const resumeTimer=()=>{timerPausedRef.current=false;setTimerPaused(false);};
  const [_timerInit]=useState(()=>{
    // Start paused until commissioner starts draft
    timerPausedRef.current=true;
    return null;
  });

  // ── Draft order computation ───────────────────────────────────────────────
  const totalPicks=Object.keys(picks).length;
  const n=Math.max(draftOrder.length,1);
  const round=Math.floor(totalPicks/n);
  const pos=totalPicks%n;

  const onClock=useMemo(()=>{
    if(draftOrder.length===0) return "";
    if(rotationType==="snake"){
      return round%2===0?draftOrder[pos]:draftOrder[n-1-pos];
    }
    if(rotationType==="linear"){
      return draftOrder[pos];
    }
    if(rotationType==="third_round_reversal"){
      // Rounds 0,1 snake; round 2 reverses again and stays reversed for all odd rounds after
      const effectiveRound=round;
      if(effectiveRound%2===0) return draftOrder[pos];
      return draftOrder[n-1-pos];
    }
    return draftOrder[pos];
  },[draftOrder,rotationType,round,pos,n]);

  // ── Roster limit helpers ──────────────────────────────────────────────────
  const getRosterStatus=(team)=>{
    const total=Object.values(picks).filter(t=>t===team).length;
    return {total,remaining:picksPerTeam-total};
  };
  const canDraft=(team)=>getRosterStatus(team).remaining>0;

  const getColor=(name)=>{
    const i=teams.indexOf(name);
    return TEAM_COLORS[((i%TEAM_COLORS.length)+TEAM_COLORS.length)%TEAM_COLORS.length];
  };

  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2600);};

  // ── All wrestlers flat list ───────────────────────────────────────────────
  const allWrestlers=useMemo(()=>{
    const list=[];
    WEIGHT_CLASSES.forEach(w=>(wrestlers[w]||[]).forEach(wr=>list.push({...wr,weight:w})));
    return list;
  },[wrestlers]);

  // ── Search results ────────────────────────────────────────────────────────
  const searchResults=useMemo(()=>{
    if(!searchQ.trim()) return [];
    const q=searchQ.toLowerCase();
    const hits=allWrestlers.filter(w=>
      w.name.toLowerCase().includes(q)||w.school.toLowerCase().includes(q)
    ).slice(0,8).map(w=>({...w,takenBy:picks[pickKey(w.weight,w.seed)],isCustom:false}));
    if(hits.length===0&&searchQ.trim().length>1)
      return [{isCustom:true,name:searchQ.trim(),school:"",weight:null,seed:null}];
    return hits;
  },[searchQ,allWrestlers,picks]);

  // ── Draft actions ─────────────────────────────────────────────────────────
  const draftPick=(weight,seed,forTeam)=>{
    const team=forTeam||onClock;
    const key=pickKey(weight,seed);
    if(picks[key]){showToast("Already drafted!","err");return;}
    if(!canDraft(team)){showToast(`${team} roster full (${picksPerTeam} picks)!`,"err");return;}
    // Check if this weight class is exhausted
    const weightWrestlers=wrestlers[weight]||[];
    const weightPicked=weightWrestlers.filter(wr=>picks[pickKey(weight,wr.seed)]).length;
    if(weightPicked>=weightWrestlers.length){showToast(`No wrestlers left at ${weight}lb!`,"err");return;}
    const existsAtWeight=Object.entries(picks).some(([k,t])=>t===team&&k.startsWith(`${weight}-`));
    const isBonus=existsAtWeight||!WEIGHT_CLASSES.includes(weight);
    if(isBonus&&!bonusPickEnabled){showToast("Bonus picks are disabled in settings","err");return;}
    setPicks(p=>({...p,[key]:team}));
    const wr=allWrestlers.find(w=>w.weight===weight&&w.seed===seed);
    showToast(`${wr?.name||"Wrestler"} → ${team}${isBonus?" ⭐ BONUS":""}`,isBonus?"info":"ok");
    setHlKey(key);setTimeout(()=>setHlKey(null),1200);
    setSearchQ("");
    resetTimer();
  };

  const draftCustom=(rawName,forTeam)=>{
    const team=forTeam||onClock;
    if(!rawName.trim()) return;
    if(!canDraft(team)){showToast(`${team} roster full!`,"err");return;}
    const idx=buildNameIndex(wrestlers);
    const m=fuzzyFind(rawName,idx,3);
    if(m){draftPick(m.entry.weight,m.entry.seed,team);return;}
    const customSeed=900+totalPicks;
    const customWeight=0;
    setWrestlers(prev=>{
      const bucket=prev[customWeight]||[];
      return {...prev,[customWeight]:[...bucket,{seed:customSeed,name:rawName.trim(),school:""}]};
    });
    const key=pickKey(customWeight,customSeed);
    setPicks(p=>({...p,[key]:team}));
    showToast(`${rawName.trim()} → ${team}`,"ok");
    setSearchQ("");
    resetTimer();
  };

  // Override pick assignment (team reassign)
  const reassignPick=(key,newTeam)=>{
    setPicks(p=>({...p,[key]:newTeam}));
    showToast(`Pick reassigned → ${newTeam}`,"info");
  };

  const undoPick=(weight,seed)=>{
    const key=pickKey(weight,seed);
    const wr=allWrestlers.find(w=>w.weight===weight&&w.seed===seed);
    setPicks(p=>{const n={...p};delete n[key];return n;});
    showToast(`Undid ${wr?.name||"pick"}`,"info");
    resetTimer();
  };

  const getRoster=(team)=>{
    const out=[];
    [...WEIGHT_CLASSES,0].forEach(w=>{
      (wrestlers[w]||[]).forEach(wr=>{
        const key=pickKey(w,wr.seed);
        if(picks[key]===team) out.push({...wr,weight:w,pts:points[key]||0,key});
      });
    });
    return out;
  };

  const teamScores=useMemo(()=>{
    return teams.map(team=>{
      let total=0;const breakdown=[];
      [...WEIGHT_CLASSES,0].forEach(w=>{
        (wrestlers[w]||[]).forEach(wr=>{
          const key=pickKey(w,wr.seed);
          if(picks[key]===team){
            const pts=points[key]||0;total+=pts;
            if(pts>0) breakdown.push({...wr,weight:w,pts});
          }
        });
      });
      return {team,total,breakdown};
    }).sort((a,b)=>b.total-a.total);
  },[teams,picks,points,wrestlers]);

  const availCount=(w)=>(wrestlers[w]||[]).filter(wr=>!picks[pickKey(w,wr.seed)]).length;
  const topAvail=(w)=>(wrestlers[w]||[]).find(wr=>!picks[pickKey(w,wr.seed)]);

  return (
    <div style={{minHeight:"100vh",background:"#070a0e",color:"#d0c8b4",fontFamily:"'Oswald',sans-serif"}}>
      <style>{css}</style>
      {toast&&(
        <div className="slide-down" style={{position:"fixed",top:14,right:14,zIndex:9999,
          background:toast.type==="err"?"#1e0a0a":toast.type==="info"?"#0a1220":"#0a1e14",
          border:`1px solid ${toast.type==="err"?"#7f1d1d":toast.type==="info"?"#1e3a5f":"#14532d"}`,
          color:toast.type==="err"?"#fca5a5":toast.type==="info"?"#93c5fd":"#86efac",
          padding:"9px 16px",borderRadius:6,fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:600,boxShadow:"0 8px 32px #00000099",maxWidth:320}}>
          {toast.msg}
        </div>
      )}
      <Header onClock={onClock} totalPicks={totalPicks} round={round} pos={pos}
        teams={teams} draftOrder={draftOrder} rotationType={rotationType}
        searchQ={searchQ} setSearchQ={setSearchQ} searchResults={searchResults}
        picks={picks} getColor={getColor} draftPick={draftPick} draftCustom={draftCustom}
        activePage={activePage} setActivePage={setActivePage} getRoster={getRoster}
        timerSec={timerSec} timerPaused={timerPaused} pauseTimer={pauseTimer} resumeTimer={resumeTimer}
        isCommissioner={isCommissioner} draftStarted={draftStarted}
        getRosterStatus={getRosterStatus} picksPerTeam={picksPerTeam} showToast={showToast}/>

      <div style={{maxWidth:1600,margin:"0 auto",padding:"16px 16px 40px"}}>
        {activePage==="board"&&<BoardPage wrestlers={wrestlers} picks={picks} points={points}
          draftPick={draftPick} hlKey={hlKey} teams={teams}
          getColor={getColor} availCount={availCount} reassignPick={reassignPick}
          draftOrder={draftOrder} rotationType={rotationType} totalPicks={totalPicks}/>}
        {activePage==="scores"&&<ScoresPage wrestlers={wrestlers} picks={picks} points={points}
          setPoints={setPoints} getColor={getColor} allWrestlers={allWrestlers}/>}
        {activePage==="standings"&&<StandingsPage teamScores={teamScores} getColor={getColor} getRoster={getRoster}/>}

        {activePage==="settings"&&<SettingsPage
          teams={teams} setTeams={setTeams}
          draftOrder={draftOrder} setDraftOrder={setDraftOrder}
          rotationType={rotationType} setRotationType={setRotationType}
          bonusPickEnabled={bonusPickEnabled} setBonusPickEnabled={setBonusPickEnabled}
          picks={picks} setPicks={setPicks} setPoints={setPoints}
          getRoster={getRoster} getColor={getColor} showToast={showToast}
          picksPerTeam={picksPerTeam} wrestlers={wrestlers}
          draftStarted={draftStarted}
          onStartDraft={()=>{setDraftStarted(true);resetTimer();setActivePage("board");}}/>}
        {teams.includes(activePage)&&<RosterPage team={activePage} roster={getRoster(activePage)}
          getColor={getColor} picksPerTeam={picksPerTeam}
          allWrestlers={allWrestlers} picks={picks} setPicks={setPicks} wrestlers={wrestlers}
          bonusKeys={bonusKeys} setBonusKeys={setBonusKeys}
          bonusPickEnabled={bonusPickEnabled} showToast={showToast}/>}
      </div>
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────
function Header({onClock,totalPicks,round,pos,teams,draftOrder,rotationType,
  searchQ,setSearchQ,searchResults,picks,getColor,draftPick,draftCustom,
  activePage,setActivePage,getRoster,timerSec,timerPaused,pauseTimer,resumeTimer,
  isCommissioner,draftStarted,getRosterStatus,picksPerTeam,showToast}){
  const clk=onClock?getColor(onClock):null;
  const mins=Math.floor(timerSec/60);
  const secs=timerSec%60;
  const timerStr=`${mins>0?mins+"m ":""}${secs.toString().padStart(2,"0")}s`;
  const timerColor=timerSec<30?"#34d399":timerSec<60?"#f59e0b":timerSec<120?"#f97316":"#ef4444";
  const clkStatus=onClock?getRosterStatus(onClock):null;
  const n=Math.max(draftOrder.length,1);

  // Peek: who picks next
  const nextPos=(totalPicks+1)%n;
  const nextRound=Math.floor((totalPicks+1)/n);
  const nextTeam=draftOrder.length===0?"":(
    rotationType==="linear"?draftOrder[nextPos]:
    nextRound%2===0?draftOrder[nextPos]:draftOrder[n-1-nextPos]
  );

  return (
    <div style={{background:"#0b0f14",borderBottom:"2px solid #c9a84c",position:"sticky",top:0,zIndex:100}}>
      {/* Pre-draft overlay banner */}
      {!draftStarted&&(
        <div style={{background:"#0d0a00",borderBottom:"1px solid #c9a84c33",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>⚙</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:".1em",color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif"}}>COMMISSIONER MUST CONFIRM SETTINGS PRIOR TO START</div>
              <div style={{fontSize:10,color:"#5a4a20",letterSpacing:".08em",fontFamily:"'Barlow Condensed',sans-serif"}}>Draft board, timer, and picks are locked until the draft is started</div>
            </div>
          </div>
          <div style={{fontSize:10,color:"#3a3010",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".15em",border:"1px solid #3a3010",padding:"3px 10px",borderRadius:3}}>PRE-DRAFT</div>
        </div>
      )}
      <div style={{maxWidth:1600,margin:"0 auto",padding:"10px 16px 8px",display:"flex",alignItems:"center",gap:11,flexWrap:"wrap",opacity:draftStarted?1:0.25,pointerEvents:draftStarted?"auto":"none",filter:draftStarted?"none":"grayscale(0.5)"}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"radial-gradient(circle at 35% 35%,#e6c84e,#7a5810)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 0 12px #c9a84c44"}}>🥇</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:".1em",color:"#c9a84c",lineHeight:1.1}}>NCAA WRESTLING</div>
            <div style={{fontSize:8,fontWeight:300,letterSpacing:".22em",color:"#6a5a30"}}>FANTASY DRAFT BOARD</div>
          </div>
        </div>

        {/* On the clock */}
        <div style={{padding:"6px 11px",background:"#070a0e",border:`1px solid ${clk?clk.bg+"55":"#1e2530"}`,borderRadius:7,flexShrink:0,minWidth:155,boxShadow:clk?`0 0 12px ${clk.bg}22`:"none",transition:"all .3s"}}>
          <div style={{fontSize:8,letterSpacing:".2em",color:"#4a4020",marginBottom:1}}>ON THE CLOCK</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {onClock&&<div className="pulse" style={{width:8,height:8,borderRadius:"50%",background:clk.bg,boxShadow:`0 0 7px ${clk.bg}`,flexShrink:0}}/>}
            <span style={{fontSize:17,fontWeight:700,color:onClock?clk.text:"#555",letterSpacing:".04em"}}>{onClock||"—"}</span>
          </div>
          <div style={{fontSize:9,color:"#3a3820",marginTop:1,fontFamily:"'Barlow Condensed',sans-serif"}}>
            Pick #{totalPicks+1} · Rd {round+1} · {rotationType==="snake"?"🐍 Snake":rotationType==="linear"?"→ Linear":"↕ Custom"}
          </div>
          {/* Slot dots */}
          {clkStatus&&(
            <div style={{display:"flex",gap:3,marginTop:4,alignItems:"center"}}>
              {Array.from({length:picksPerTeam}).map((_,i)=>{
                const filled=i<(picksPerTeam-clkStatus.remaining);
                const isBonus=i===10;
                return <div key={i} style={{width:isBonus?9:7,height:isBonus?9:7,borderRadius:isBonus?"2px":"50%",background:filled?(isBonus?"#c9a84c":clk.bg):"#1a1f26",border:`1px solid ${filled?(isBonus?"#c9a84c88":clk.bg+"66"):"#2a2f36"}`,transition:"all .2s",flexShrink:0}}/>;
              })}
              <span style={{fontSize:9,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif",marginLeft:2}}>{clkStatus.remaining} left</span>
            </div>
          )}
          {/* Up next preview */}
          {nextTeam&&nextTeam!==onClock&&(
            <div style={{fontSize:9,color:"#3a4028",fontFamily:"'Barlow Condensed',sans-serif",marginTop:3}}>
              Up next: <span style={{color:getColor(nextTeam).text+"99"}}>{nextTeam}</span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <div style={{padding:"7px 12px",background:"#070a0e",border:`1px solid ${timerPaused?"#1a3a5c":timerSec>=60?"#3a1800":"#1e2530"}`,borderRadius:7,textAlign:"center",minWidth:82,boxShadow:timerSec>=120&&!timerPaused?`0 0 12px ${timerColor}44`:"none",transition:"all .5s"}}>
            <div style={{fontSize:8,letterSpacing:".2em",color:timerPaused?"#2a4a6a":"#4a4020",marginBottom:1}}>{timerPaused?"PAUSED":"PICK TIMER"}</div>
            <div style={{fontSize:22,fontWeight:700,color:timerPaused?"#4a7aaa":timerColor,lineHeight:1,transition:"color .5s"}}>{timerStr}</div>
            {!timerPaused&&timerSec>=60&&<div style={{fontSize:8,color:timerColor,opacity:.7,letterSpacing:".1em",marginTop:1}}>
              {timerSec<120?"SLOW":timerSec<180?"HURRY UP":"⚠ VERY SLOW"}
            </div>}
            {timerPaused&&<div style={{fontSize:8,color:"#4a7aaa",opacity:.8,letterSpacing:".1em",marginTop:1}}>COMMISSIONER</div>}
          </div>
          {isCommissioner&&(
            <button onClick={timerPaused?resumeTimer:pauseTimer}
              title={timerPaused?"Resume timer":"Pause timer"}
              style={{width:32,height:32,borderRadius:6,border:`1px solid ${timerPaused?"#c9a84c":"#2a3040"}`,background:timerPaused?"#c9a84c22":"#0d1117",color:timerPaused?"#c9a84c":"#6a7a8a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"all .2s",flexShrink:0}}>
              {timerPaused?"▶":"⏸"}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{flex:1,minWidth:200,position:"relative"}}>
          <input className="inp" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&searchQ.trim()){const r=searchResults[0];if(r&&!r.isCustom&&!r.takenBy)draftPick(r.weight,r.seed);else if(r?.isCustom)draftCustom(searchQ.trim());}}}
            placeholder={`Search to draft for ${onClock||"…"} — or type any name`}/>
          {searchQ&&(
            <div className="slide-down" style={{position:"absolute",top:"calc(100% + 3px)",left:0,right:0,zIndex:400,background:"#0d1117",border:"1px solid #1e2530",borderRadius:6,overflow:"hidden",boxShadow:"0 12px 40px #00000099"}}>
              {searchResults.map((wr,i)=>{
                if(wr.isCustom) return (
                  <div key="c" className="wrow" style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8,background:"#0f140a"}}>
                    <span style={{fontSize:12,color:"#6a8a40",fontFamily:"'Barlow Condensed',sans-serif",flex:1}}>Draft "{wr.name}" as custom wrestler</span>
                    <button className="btn btn-sm btn-primary" onClick={()=>draftCustom(wr.name)}>DRAFT CUSTOM</button>
                  </div>
                );
                const tb=wr.takenBy;
                return (
                  <div key={`${wr.weight}-${wr.seed}`} className="wrow" style={{padding:"6px 10px",borderBottom:"1px solid #111820",display:"flex",alignItems:"center",gap:7,background:tb?"#0e0c0c":"transparent"}}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:30,flexShrink:0}}>{wr.weight}lb</span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:18}}>#{wr.seed}</span>
                    <span style={{flex:1,fontSize:13,color:tb?"#4a4030":"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</span>
                    <span style={{fontSize:10,color:"#3a3a30",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{wr.school}</span>
                    {tb
                      ?<span style={{fontSize:10,color:getColor(tb).text,fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{tb}</span>
                      :<button className="btn btn-primary btn-sm" onClick={()=>draftPick(wr.weight,wr.seed)}>DRAFT</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {[{v:totalPicks,l:"DRAFTED",c:"#c9a84c"},{v:draftOrder.length*picksPerTeam-totalPicks,l:"REMAIN",c:"#34d399"},{v:round+1,l:"ROUND",c:"#93c5fd"}].map(s=>(
            <div key={s.l} style={{textAlign:"center",padding:"3px 8px",background:"#070a0e",border:"1px solid #1e2530",borderRadius:5,minWidth:46}}>
              <div style={{fontSize:18,fontWeight:700,color:s.c,lineHeight:1.1}}>{s.v}</div>
              <div style={{fontSize:8,color:"#3a3820",letterSpacing:".12em"}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{maxWidth:1600,margin:"0 auto",padding:"0 16px",display:"flex",gap:0,overflowX:"auto",marginBottom:-2}}>
        {[{id:"board",label:"DRAFT BOARD"},{id:"scores",label:"📥 SCORES"},{id:"standings",label:"🏆 STANDINGS"},{id:"settings",label:"⚙ SETTINGS",commissionerOnly:true}].map(tab=>{
          const isActive=activePage===tab.id;
          const preDraftLocked=!draftStarted&&tab.id!=="settings";
          const commLocked=tab.commissionerOnly&&!isCommissioner;
          return (
            <button key={tab.id} className="tab-link"
              onClick={()=>{
                if(preDraftLocked) return;
                if(commLocked){showToast("Only the commissioner can access Settings","err");return;}
                setActivePage(tab.id);
              }}
              title={preDraftLocked?"Draft has not started yet":commLocked?"Commissioner only":""}
              style={{padding:"7px 13px",fontSize:11,fontWeight:600,letterSpacing:".12em",
                color:isActive?"#c9a84c":preDraftLocked?"#252010":commLocked?"#3a2a10":"#4a4020",
                borderBottom:isActive?"2px solid #c9a84c":"2px solid transparent",
                cursor:preDraftLocked?"default":commLocked?"not-allowed":"pointer",
                opacity:preDraftLocked?0.35:1}}>
              {tab.label}{commLocked?" 🔒":""}
            </button>
          );
        })}
        <div style={{width:1,background:"#1e2530",margin:"5px 5px 1px"}}/>
        {teams.map(t=>{
          const c=getColor(t);const r=getRoster(t).length;const isA=activePage===t;
          const status=getRosterStatus(t);
          return (
            <button key={t} className="tab-link" onClick={()=>setActivePage(t)} style={{padding:"7px 10px",fontSize:10,fontWeight:500,letterSpacing:".05em",color:isA?c.text:c.text+"55",borderBottom:isA?`2px solid ${c.bg}`:"2px solid transparent",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:c.bg,flexShrink:0,boxShadow:isA?`0 0 5px ${c.bg}`:"none"}}/>
              {t}
              <span style={{fontSize:9,color:status.remaining===0?"#c9a84c88":"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>({r}/{picksPerTeam})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ─── BOARD PAGE ───────────────────────────────────────────────────────────────

// ─── BOARD PAGE ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12; // wrestlers per page per weight column

function BoardPage({wrestlers,picks,points,draftPick,hlKey,getColor,
  availCount,reassignPick,teams,draftOrder,rotationType,totalPicks}){
  const [overrideKey,setOverrideKey]=useState(null);
  // Per-weight page index (0-based). Reset all to 0 whenever a new pick is made.
  const [pages,setPages]=useState(()=>Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,0])));
  const prevPicksRef=useRef(totalPicks);
  if(prevPicksRef.current!==totalPicks){
    prevPicksRef.current=totalPicks;
    // Reset all pages to 0 on each pick (done synchronously during render is fine for a ref-guard)
    const reset=Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,0]));
    // Use a deferred state update instead of setState-during-render:
    setTimeout(()=>setPages(reset),0);
  }

  const setPage=(w,p)=>setPages(prev=>({...prev,[w]:p}));

  // Find wrestler + current team for the modal title
  const overrideMeta=useMemo(()=>{
    if(!overrideKey) return null;
    const [w,s]=overrideKey.split("-");
    const wr=(wrestlers[parseInt(w)]||[]).find(x=>x.seed===parseInt(s));
    return {name:wr?.name||"Wrestler",team:picks[overrideKey]};
  },[overrideKey,wrestlers,picks]);

  // Build upcoming picks queue (next 10)
  const upcomingPicks=useMemo(()=>{
    const n=Math.max(draftOrder.length,1);
    const queue=[];
    for(let offset=0;offset<Math.min(10,n*2);offset++){
      const t=totalPicks+offset;
      const r=Math.floor(t/n);const p=t%n;
      let team;
      if(rotationType==="linear") team=draftOrder[p];
      else team=r%2===0?draftOrder[p]:draftOrder[n-1-p];
      if(team) queue.push({pickNum:t+1,round:r+1,team,isCurrent:offset===0});
    }
    return queue;
  },[draftOrder,rotationType,totalPicks]);

  return (
    <div>
      {/* ── Reassign modal — full-screen backdrop blocks all clicks ── */}
      {overrideKey&&overrideMeta&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,
          background:"rgba(0,0,0,0.78)",
          display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setOverrideKey(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#111820",border:"2px solid #c9a84c",borderRadius:10,
              boxShadow:"0 24px 64px #000000",width:260,overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"12px 16px",background:"#0a1018",borderBottom:"1px solid #c9a84c44"}}>
              <div style={{fontSize:9,letterSpacing:".18em",color:"#8a7040",
                fontFamily:"'Oswald',sans-serif",marginBottom:4}}>REASSIGN PICK</div>
              <div style={{fontSize:15,fontWeight:700,color:"#e0d8b4",
                fontFamily:"'Barlow Condensed',sans-serif",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {overrideMeta.name}
              </div>
              <div style={{fontSize:10,color:"#4a5040",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
                Currently:{" "}
                <span style={{color:overrideMeta.team?getColor(overrideMeta.team).text:"#888",fontWeight:600}}>
                  {overrideMeta.team}
                </span>
              </div>
            </div>
            {/* Scrollable team list — max 4 rows visible */}
            <div style={{maxHeight:176,overflowY:"auto",
              scrollbarWidth:"thin",scrollbarColor:"#c9a84c44 #0a0f16"}}>
              {teams.map(t=>{
                const tc2=getColor(t);
                const isCurrent=t===overrideMeta.team;
                return (
                  <button key={t}
                    onClick={()=>{reassignPick(overrideKey,t);setOverrideKey(null);}}
                    style={{width:"100%",padding:"11px 16px",display:"flex",alignItems:"center",
                      gap:12,background:isCurrent?"#1e2c3a":"#111820",
                      border:"none",borderBottom:"1px solid #1a2028",
                      cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background=isCurrent?"#243545":"#1a2535"}
                    onMouseLeave={e=>e.currentTarget.style.background=isCurrent?"#1e2c3a":"#111820"}>
                    <span style={{width:12,height:12,borderRadius:"50%",flexShrink:0,
                      background:tc2.bg,boxShadow:`0 0 8px ${tc2.bg}`}}/>
                    <span style={{flex:1,fontSize:14,
                      fontWeight:isCurrent?700:400,
                      color:isCurrent?tc2.text:"#c0c8b8",
                      fontFamily:"'Barlow Condensed',sans-serif"}}>{t}</span>
                    {isCurrent&&(
                      <span style={{fontSize:11,color:tc2.text,
                        fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Cancel */}
            <button onClick={()=>setOverrideKey(null)}
              style={{width:"100%",padding:"10px 16px",background:"#0a0f16",border:"none",
                borderTop:"1px solid #c9a84c44",fontSize:11,letterSpacing:".12em",
                color:"#5a6050",fontFamily:"'Oswald',sans-serif",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.color="#9aa090"}
              onMouseLeave={e=>e.currentTarget.style.color="#5a6050"}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── Live draft queue ── */}
      <div className="card" style={{marginBottom:14}}>
        <div style={{padding:"6px 14px 5px",borderBottom:"1px solid #1a1f26",background:"#0d1219",
          display:"flex",alignItems:"center",gap:10,borderRadius:"8px 8px 0 0"}}>
          <span style={{fontSize:10,letterSpacing:".18em",color:"#6a5a30",
            fontFamily:"'Oswald',sans-serif"}}>UPCOMING PICKS</span>
          <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>
            {rotationType==="snake"?"🐍 Snake":rotationType==="linear"?"→ Linear":"↕ Custom"}
          </span>
        </div>
        <div style={{display:"flex",overflowX:"auto",padding:"10px 10px 8px",alignItems:"flex-start"}}>
          {upcomingPicks.map((p,i)=>{
            const c=getColor(p.team);
            const isNow=p.isCurrent;
            return (
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",
                flexShrink:0,padding:isNow?"10px 12px 8px":"6px 10px 8px",marginRight:3,
                borderRadius:7,background:isNow?`${c.bg}28`:"transparent",
                border:isNow?`1px solid ${c.bg}66`:"1px solid transparent",
                minWidth:86,position:"relative",transition:"all .25s"}}>
                {isNow&&(
                  <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",
                    fontSize:8,color:"#070a0e",background:c.bg,padding:"1px 8px",
                    borderRadius:"0 0 5px 5px",fontFamily:"'Oswald',sans-serif",fontWeight:700,
                    letterSpacing:".1em",whiteSpace:"nowrap",boxShadow:`0 2px 8px ${c.bg}66`}}>
                    ON CLOCK
                  </div>
                )}
                <div style={{marginTop:isNow?12:0,marginBottom:6,
                  width:isNow?34:22,height:isNow?34:22,borderRadius:"50%",
                  background:isNow?`radial-gradient(circle at 35% 35%,${c.bg},${c.bg}88)`:c.bg+"44",
                  border:`2px solid ${isNow?c.bg:c.bg+"77"}`,
                  boxShadow:isNow?`0 0 16px ${c.bg}77`:"none",
                  flexShrink:0,transition:"all .3s"}}/>
                <div style={{fontSize:isNow?12:10,fontWeight:isNow?700:500,
                  color:isNow?c.text:c.text+"88",fontFamily:"'Barlow Condensed',sans-serif",
                  textAlign:"center",maxWidth:82,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap",marginBottom:3}}>
                  {p.team}
                </div>
                <div style={{fontSize:9,color:isNow?"#c9a84c99":"#2a3020",
                  fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".06em"}}>
                  Pk {p.pickNum} · R{p.round}
                </div>
              </div>
            );
          })}
          {upcomingPicks.length===0&&(
            <div style={{padding:"14px 16px",color:"#3a3820",fontSize:12,
              fontFamily:"'Barlow Condensed',sans-serif"}}>
              Draft complete or no teams configured
            </div>
          )}
        </div>
      </div>

      {/* Weight columns */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {WEIGHT_CLASSES.map(w=>{
          const allWrs=wrestlers[w]||[];
          const totalPages=Math.ceil(allWrs.length/PAGE_SIZE);
          const pg=pages[w]||0;
          const pageWrs=allWrs.slice(pg*PAGE_SIZE,(pg+1)*PAGE_SIZE);
          return (
          <div id={`wc-${w}`} key={w} className="card card-h">
            <div style={{padding:"9px 12px 7px",borderBottom:"1px solid #1a1f26",
              display:"flex",alignItems:"flex-end",justifyContent:"space-between",background:"#0d1219"}}>
              <div>
                <span style={{fontSize:26,fontWeight:700,color:"#c9a84c",lineHeight:1}}>{w}</span>
                <span style={{fontSize:11,color:"#4a4020",marginLeft:3,
                  fontFamily:"'Barlow Condensed',sans-serif"}}>lbs</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:700,lineHeight:1,
                  color:availCount(w)>16?"#22c55e":availCount(w)>8?"#f59e0b":"#ef4444"}}>
                  {availCount(w)}
                </div>
                <div style={{fontSize:8,color:"#3a3820",letterSpacing:".12em"}}>AVAIL</div>
              </div>
            </div>
            {pageWrs.map((wr,i)=>{
              const key=pickKey(w,wr.seed);
              const tb=picks[key];
              const tc=tb?getColor(tb):null;
              const isHl=hlKey===key;
              const pts=points[key]||0;
              return (
                <div key={wr.seed}
                  className={`wrow ${tb?"taken-row":""} ${isHl?"flash-row":""}`}
                  style={{padding:"5px 8px",
                    borderBottom:i<pageWrs.length-1?"1px solid #0f1318":"none",
                    display:"flex",alignItems:"center",gap:0,
                    background:tb?`${tc.bg}0e`:"transparent",
                    borderLeft:tb?`3px solid ${tc.bg}`:"3px solid transparent"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
                    width:20,fontSize:12,flexShrink:0,textAlign:"center",
                    color:wr.seed<=2?"#c9a84c":wr.seed<=4?"#a08030":wr.seed<=8?"#505840":wr.seed<=16?"#2a3838":"#1e2a22"}}>
                    {wr.seed}
                  </span>
                  <div style={{flex:1,minWidth:0,paddingLeft:4}}>
                    <div style={{fontSize:12,color:tb?"#3a3020":"#c0b898",
                      fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</div>
                    <div style={{fontSize:9,color:tb?"#2a2818":"#303830",
                      fontFamily:"'Barlow Condensed',sans-serif",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.school}</div>
                  </div>
                  {tb?(
                    <button onClick={()=>setOverrideKey(key)}
                      title="Click to reassign to a different team"
                      style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",flexShrink:0,
                        background:tc.bg+"33",border:`1px solid ${tc.bg}66`,borderRadius:4,
                        cursor:"pointer",transition:"background .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=tc.bg+"55"}
                      onMouseLeave={e=>e.currentTarget.style.background=tc.bg+"33"}>
                      {pts>0&&(
                        <span style={{fontSize:9,color:"#34d399",
                          fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,marginRight:2}}>
                          {pts}pt
                        </span>
                      )}
                      <span style={{width:5,height:5,borderRadius:"50%",
                        background:tc.bg,flexShrink:0}}/>
                      <span style={{fontSize:9,color:tc.text,
                        fontFamily:"'Barlow Condensed',sans-serif",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        maxWidth:52,fontWeight:600}}>{tb}</span>
                      <span style={{fontSize:8,color:tc.text+"cc"}}>▾</span>
                    </button>
                  ):(
                    <button className="btn btn-sm" onClick={()=>draftPick(w,wr.seed)}
                      style={{padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a3824",
                        borderRadius:4,color:"#2a6a44",fontSize:9,fontFamily:"'Oswald',sans-serif",
                        fontWeight:600,letterSpacing:".07em",flexShrink:0}}>DRAFT</button>
                  )}
                </div>
              );
            })}
            {/* Pagination footer */}
            {totalPages>1&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 8px",borderTop:"1px solid #0f1318",background:"#080c10"}}>
                <button onClick={()=>setPage(w,pg-1)} disabled={pg===0}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===0?"transparent":"#0d1520",color:pg===0?"#1e2530":"#c9a84c",
                    cursor:pg===0?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {Array.from({length:totalPages}).map((_,pi)=>(
                    <button key={pi} onClick={()=>setPage(w,pi)}
                      style={{width:pi===pg?20:8,height:8,borderRadius:4,border:"none",
                        background:pi===pg?"#c9a84c":"#1e2530",cursor:"pointer",
                        transition:"all .2s",padding:0,flexShrink:0}}/>
                  ))}
                </div>
                <button onClick={()=>setPage(w,pg+1)} disabled={pg===totalPages-1}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===totalPages-1?"transparent":"#0d1520",
                    color:pg===totalPages-1?"#1e2530":"#c9a84c",
                    cursor:pg===totalPages-1?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({teams,setTeams,draftOrder,setDraftOrder,rotationType,setRotationType,
  bonusPickEnabled,setBonusPickEnabled,picks,setPicks,setPoints,getRoster,getColor,showToast,picksPerTeam,wrestlers,
  draftStarted,onStartDraft}){
  const [newTeam,setNewTeam]=useState("");
  const [dragging,setDragging]=useState(null);
  const [dragOver2,setDragOver2]=useState(null);

  // Sync draftOrder when teams change (add new ones to end, remove missing)
  const syncOrder=(newTeams)=>{
    setTeams(newTeams);
    setDraftOrder(prev=>{
      const kept=prev.filter(t=>newTeams.includes(t));
      const added=newTeams.filter(t=>!prev.includes(t));
      return [...kept,...added];
    });
  };

  const addTeam=()=>{
    const n=newTeam.trim();
    if(!n||teams.includes(n)) return;
    if(teams.length>=TEAM_HARD_CAP){
      showToast(`Hard cap reached — max ${TEAM_HARD_CAP} teams allowed`,"err");
      return;
    }
    const newCount=teams.length+1;
    const totalWrestlers=Object.values(wrestlers).reduce((s,arr)=>s+arr.length,0);
    const picksNeeded=newCount*(bonusPickEnabled?PICKS_PER_TEAM_BONUS:PICKS_PER_TEAM_BASE);
    syncOrder([...teams,n]);
    setNewTeam("");
    if(newCount>TEAM_SOFT_CAP){
      showToast(`⚠ ${n} added — ${newCount} teams may exhaust wrestler pool (${picksNeeded}/${totalWrestlers} picks needed)`,"info");
    } else {
      showToast(`${n} added`,"ok");
    }
  };

  const removeTeam=(t)=>{
    syncOrder(teams.filter(x=>x!==t));
    showToast(`${t} removed`,"info");
  };

  // Drag-to-reorder draft order
  const handleDragStart=(e,idx)=>{setDragging(idx);e.dataTransfer.effectAllowed="move";};
  const handleDragOver=(e,idx)=>{e.preventDefault();setDragOver2(idx);};
  const handleDrop=(e,idx)=>{
    e.preventDefault();
    if(dragging===null||dragging===idx){setDragging(null);setDragOver2(null);return;}
    const newOrder=[...draftOrder];
    const [moved]=newOrder.splice(dragging,1);
    newOrder.splice(idx,0,moved);
    setDraftOrder(newOrder);
    setDragging(null);setDragOver2(null);
  };

  const moveUp=(i)=>{if(i===0)return;const o=[...draftOrder];[o[i-1],o[i]]=[o[i],o[i-1]];setDraftOrder(o);};
  const moveDown=(i)=>{if(i===draftOrder.length-1)return;const o=[...draftOrder];[o[i],o[i+1]]=[o[i+1],o[i]];setDraftOrder(o);};
  const randomize=()=>{
    const o=[...draftOrder];
    for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]];}
    setDraftOrder(o);showToast("Order randomized!","ok");
  };

  // Preview next 8 picks
  const pickPreview=useMemo(()=>{
    const n=Math.max(draftOrder.length,1);
    const total=Object.keys(picks).length;
    return Array.from({length:Math.min(8,draftOrder.length*2)}).map((_,offset)=>{
      const t=total+offset;
      const r=Math.floor(t/n);const p=t%n;
      let team;
      if(rotationType==="linear") team=draftOrder[p];
      else team=r%2===0?draftOrder[p]:draftOrder[n-1-p];
      return {pick:total+offset+1,round:r+1,team};
    });
  },[draftOrder,rotationType,picks]);

  return (
    <div style={{maxWidth:860}}>
      <div style={{marginBottom:22}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>DRAFT SETTINGS</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Configure pick rotation, draft order, and roster rules</p>
      </div>

      {/* ── Rotation type ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:12}}>PICK ROTATION</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[
            {id:"snake",icon:"🐍",label:"Snake Draft",desc:"Rd 1: 1→10, Rd 2: 10→1, alternates each round"},
            {id:"linear",icon:"→",label:"Linear Draft",desc:"Same order every round (1→10 always)"},
            {id:"third_round_reversal",icon:"↕",label:"3rd Round Reversal",desc:"Snake but reverses direction every other round"},
          ].map(r=>(
            <button key={r.id} onClick={()=>setRotationType(r.id)}
              style={{flex:"1 1 220px",padding:"12px 14px",background:rotationType===r.id?"#c9a84c18":"#070a0e",border:`2px solid ${rotationType===r.id?"#c9a84c":"#1e2530"}`,borderRadius:8,textAlign:"left",cursor:"pointer",transition:"all .2s"}}>
              <div style={{fontSize:20,marginBottom:5}}>{r.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:rotationType===r.id?"#c9a84c":"#c0b898",letterSpacing:".06em",marginBottom:3}}>{r.label}</div>
              <div style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.4}}>{r.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bonus pick toggle ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>ROSTER RULES</div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#c0b898",marginBottom:3}}>⭐ Bonus / Dark Horse Pick</div>
            <div style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.5}}>
              Allows each team one extra pick at any weight class ({picksPerTeam} total picks per team when enabled).
              Disable for a strict 10-wrestler-per-team format.
            </div>
          </div>
          <button onClick={()=>setBonusPickEnabled(v=>!v)}
            style={{padding:"10px 22px",background:bonusPickEnabled?"#c9a84c":"#1a1f26",color:bonusPickEnabled?"#070a0e":"#4a4030",border:`2px solid ${bonusPickEnabled?"#c9a84c":"#2a2f36"}`,borderRadius:7,fontSize:13,fontWeight:700,fontFamily:"'Oswald',sans-serif",letterSpacing:".08em",cursor:"pointer",transition:"all .2s",flexShrink:0,minWidth:100}}>
            {bonusPickEnabled?"ON ✓":"OFF"}
          </button>
        </div>
      </div>

      {/* ── Teams + draft order ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div className="sec-label">DRAFT ORDER ({draftOrder.length} teams · drag to reorder)</div>
          <div style={{display:"flex",gap:7}}>
            <button className="btn btn-ghost btn-sm" onClick={randomize}>🎲 RANDOMIZE</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setDraftOrder([...draftOrder].reverse())}>↕ REVERSE</button>
          </div>
        </div>
        {/* Add team */}
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <input className="inp" value={newTeam} onChange={e=>setNewTeam(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTeam()}
            placeholder={teams.length>=TEAM_HARD_CAP?"Hard cap reached (30 max)":"Add team name…"}
            disabled={teams.length>=TEAM_HARD_CAP}/>
          <button className="btn btn-primary btn-md" onClick={addTeam} disabled={teams.length>=TEAM_HARD_CAP}>ADD</button>
        </div>
        <div style={{fontSize:11,color:teams.length>=TEAM_HARD_CAP?"#ef4444":teams.length>TEAM_SOFT_CAP?"#f59e0b":"#4a5260",marginBottom:12,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".08em"}}>
          {teams.length>=TEAM_HARD_CAP
            ? `⛔ Hard cap reached — 30 teams maximum`
            : teams.length>TEAM_SOFT_CAP
              ? `⚠ ${teams.length}/30 teams — wrestler pool may be exhausted before draft ends`
              : `${teams.length}/30 teams · soft cap warning at 21`}
        </div>
        {/* Order list */}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {draftOrder.map((t,i)=>{
            const c=getColor(t);const r=getRoster(t).length;
            const isDraggingOver=dragOver2===i;
            return (
              <div key={t} draggable onDragStart={e=>handleDragStart(e,i)}
                onDragOver={e=>handleDragOver(e,i)} onDrop={e=>handleDrop(e,i)}
                onDragLeave={()=>setDragOver2(null)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:isDraggingOver?"#1a2010":dragging===i?"#0d1019":"#070a0e",border:`1px solid ${isDraggingOver?"#c9a84c44":c.bg+"33"}`,borderLeft:`4px solid ${c.bg}`,borderRadius:6,cursor:"grab",transition:"all .15s",opacity:dragging===i?.5:1}}>
                <span style={{fontSize:13,fontWeight:700,color:"#3a3820",minWidth:22,textAlign:"right",fontFamily:"'Barlow Condensed',sans-serif"}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:c.bg,boxShadow:`0 0 5px ${c.bg}`,flexShrink:0}}/>
                <span style={{flex:1,fontSize:14,fontWeight:500,color:c.text,letterSpacing:".05em"}}>{t}</span>
                <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>{r} picks</span>
                <div style={{display:"flex",gap:3}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>moveUp(i)} disabled={i===0} style={{padding:"2px 7px",opacity:i===0?.3:1}}>▲</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>moveDown(i)} disabled={i===draftOrder.length-1} style={{padding:"2px 7px",opacity:i===draftOrder.length-1?.3:1}}>▼</button>
                  <button className="undo-x" style={{fontSize:15,padding:"2px 6px"}} onClick={()=>removeTeam(t)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pick preview ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>UPCOMING PICK ORDER PREVIEW</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {pickPreview.map((p,i)=>{
            const c=getColor(p.team);
            return (
              <div key={i} style={{padding:"5px 10px",background:`${c.bg}18`,border:`1px solid ${c.bg}33`,borderRadius:5,display:"flex",gap:7,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",minWidth:30}}>Pk {p.pick}</span>
                <span style={{width:6,height:6,borderRadius:"50%",background:c.bg,flexShrink:0}}/>
                <span style={{fontSize:11,color:c.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{p.team}</span>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>Rd{p.round}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Apply and Start Draft ── */}
      {!draftStarted&&(
        <div className="card" style={{padding:24,border:"2px solid #c9a84c44",background:"#0d0a00",marginBottom:14,textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:".2em",color:"#6a5a20",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:8}}>COMMISSIONER — REVIEW SETTINGS ABOVE BEFORE STARTING</div>
          <div style={{fontSize:12,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:20,lineHeight:1.6}}>
            Once started, the draft board will unlock for all participants.<br/>
            The pick timer will begin and picks can be made.
          </div>
          <button
            onClick={onStartDraft}
            style={{background:"linear-gradient(135deg,#c9a84c,#a07830)",color:"#070a0e",border:"none",borderRadius:6,padding:"16px 48px",fontSize:16,fontWeight:700,letterSpacing:".15em",fontFamily:"'Oswald',sans-serif",cursor:"pointer",boxShadow:"0 0 24px #c9a84c44",transition:"all .2s",textTransform:"uppercase"}}
            onMouseOver={e=>e.target.style.boxShadow="0 0 36px #c9a84c88"}
            onMouseOut={e=>e.target.style.boxShadow="0 0 24px #c9a84c44"}>
            ▶ APPLY AND START DRAFT
          </button>
        </div>
      )}
      {draftStarted&&(
        <div className="card" style={{padding:16,marginBottom:14,border:"1px solid #14532d",background:"#050e08",textAlign:"center"}}>
          <div style={{fontSize:12,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".15em"}}>✓ DRAFT IS LIVE — SETTINGS LOCKED</div>
          <div style={{fontSize:10,color:"#1a4a28",fontFamily:"'Barlow Condensed',sans-serif",marginTop:4}}>Return to Draft Board to make picks</div>
        </div>
      )}

      {/* ── Danger zone ── */}
      <div className="card" style={{padding:16,border:"1px solid #3a1515"}}>
        <div className="sec-label" style={{color:"#7a2020",marginBottom:10}}>DANGER ZONE</div>
        <button className="btn btn-danger btn-md" onClick={()=>{if(window.confirm("Clear all picks and scores?")){{setPicks({});setPoints({});showToast("Cleared","info");}}}}>CLEAR ALL PICKS & SCORES</button>
      </div>
    </div>
  );
}

function ScoresPage({wrestlers,picks,points,setPoints,getColor,allWrestlers}){
  const [rawText,setRawText]=useState("");
  const [dragOver,setDragOver]=useState(false);
  const [preview,setPreview]=useState(null);   // {matched, unmatched}
  const [applied,setApplied]=useState(false);
  const [manualKey,setManualKey]=useState("");
  const [manualPts,setManualPts]=useState("");

  const nameIndex=useMemo(()=>buildNameIndex(wrestlers),[wrestlers]);

  const runParse=()=>{
    if(!rawText.trim()) return;
    const pairs=parseScoreText(rawText);
    const {matched,unmatched}=matchScoresToRoster(pairs,nameIndex,picks);
    setPreview({matched,unmatched});
    setApplied(false);
  };

  const applyPreview=()=>{
    if(!preview) return;
    const updates={};
    preview.matched.filter(m=>m.drafted).forEach(m=>{updates[m.key]=m.pts;});
    setPoints(prev=>({...prev,...updates}));
    setApplied(true);
  };

  const clearAll=()=>{setRawText("");setPreview(null);setApplied(false);};

  const handleFile=(e)=>{
    const file=e.dataTransfer?.files?.[0]||e.target?.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setRawText(ev.target.result);
    reader.readAsText(file);
  };

  // Manual single edit
  const applyManual=()=>{
    const pts=parseFloat(manualPts);
    if(!manualKey||isNaN(pts)) return;
    setPoints(prev=>({...prev,[manualKey]:pts}));
    setManualKey("");setManualPts("");
  };

  const draftedWrestlers=useMemo(()=>{
    const out=[];
    [...WEIGHT_CLASSES,0].forEach(w=>{
      (wrestlers[w]||[]).forEach(wr=>{
        const key=pickKey(w,wr.seed);
        if(picks[key]) out.push({...wr,weight:w,team:picks[key],key,pts:points[key]||0});
      });
    });
    return out.sort((a,b)=>b.pts-a.pts);
  },[wrestlers,picks,points]);

  const totalEntered=draftedWrestlers.filter(w=>w.pts>0).length;
  const grandTotal=draftedWrestlers.reduce((s,w)=>s+w.pts,0);

  return (
    <div>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:18,fontWeight:700,letterSpacing:".1em",color:"#c9a84c",marginBottom:4}}>IMPORT FANTASY POINTS</h2>
        <p style={{color:"#5a5030",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.6,maxWidth:700}}>
          Paste the fantasy standings or point totals directly from TrackWrestling or FloWrestling.
          Points are imported as exact numbers — no bout reconstruction needed.
          Works with standings tables, copy-pasted text, or CSV exports.
        </p>
      </div>

      {/* Drop / paste zone */}
      {!preview&&(
        <div>
          <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e);}}
            style={{marginBottom:8,padding:"10px 16px",border:`2px dashed ${dragOver?"#c9a84c":"#1e2530"}`,borderRadius:10,background:dragOver?"#1a1500":"#0b0f14",transition:"all .2s",textAlign:"center"}}>
            <span style={{fontSize:12,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif"}}>
              📂 Drop a .txt or .csv, or{" "}
              <label style={{color:"#c9a84c",cursor:"pointer",textDecoration:"underline"}}>
                browse<input type="file" accept=".txt,.csv,.tsv" onChange={handleFile} style={{display:"none"}}/>
              </label>
            </span>
          </div>
          <textarea className="inp" rows={10} value={rawText} onChange={e=>setRawText(e.target.value)}
            placeholder={`Paste TrackWrestling fantasy standings or score table here.\n\nSupported formats:\n  • TW standings: "1  Carter Starocci  Penn State  14.0"\n  • With "pts" suffix: "Carter Starocci (Penn State) — 14.0 pts"\n  • CSV: Name, School, Points  (or any column order with a header row)\n  • Copy-paste direct from TW fantasy results page\n\nPoints are used exactly as-is — no scoring formula applied.`}
            style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,lineHeight:1.6}}/>
          <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center"}}>
            <button className="btn btn-primary btn-lg" onClick={runParse} disabled={!rawText.trim()} style={{opacity:rawText.trim()?1:.4}}>PARSE & PREVIEW</button>
            <button className="btn btn-ghost btn-md" onClick={()=>setRawText("")}>CLEAR</button>
            {rawText.trim()&&<span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{rawText.trim().split("\n").filter(Boolean).length} lines</span>}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:7}}>
              <StatCard v={preview.matched.filter(m=>m.drafted).length} l="DRAFTED MATCHED" c="#34d399" bg="#0c2218" bd="#1a4030"/>
              {preview.matched.filter(m=>!m.drafted).length>0&&
                <StatCard v={preview.matched.filter(m=>!m.drafted).length} l="NOT DRAFTED" c="#93c5fd" bg="#0f1820" bd="#1a2f40"/>}
              <StatCard v={preview.unmatched.length} l="NO MATCH" c="#fca5a5" bg="#1e0a0a" bd="#3a1515"/>
            </div>
            <div style={{display:"flex",gap:8,marginLeft:"auto",alignItems:"center"}}>
              {!applied&&preview.matched.filter(m=>m.drafted).length>0&&(
                <button className="btn btn-primary btn-lg" onClick={applyPreview}>
                  ✓ APPLY {preview.matched.filter(m=>m.drafted).length} SCORES
                </button>
              )}
              {applied&&<div style={{padding:"8px 16px",background:"#0c2218",border:"1px solid #1a4030",borderRadius:6,fontSize:13,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>✓ Scores applied!</div>}
              <button className="btn btn-ghost btn-md" onClick={clearAll}>RE-PASTE</button>
            </div>
          </div>

          {/* Matched drafted */}
          {preview.matched.filter(m=>m.drafted).length>0&&(
            <div className="card" style={{marginBottom:11}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#34d399",letterSpacing:".08em"}}>✓ DRAFTED — WILL BE SCORED</span>
              </div>
              {preview.matched.filter(m=>m.drafted).map((m,i)=>{
                const tc=getColor(picks[m.key]);
                return (
                  <div key={i} style={{padding:"7px 14px",borderBottom:"1px solid #0f1318",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:28}}>{m.entry.weight}lb</span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{m.entry.seed}</span>
                    <span style={{fontSize:14,color:"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,minWidth:160}}>{m.entry.name}</span>
                    <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",flex:1}}>{m.entry.school}</span>
                    {!m.exact&&<span style={{fontSize:9,color:"#b45309",padding:"1px 5px",background:"#1e1000",border:"1px solid #2a1800",borderRadius:3,fontFamily:"'Barlow Condensed',sans-serif"}}>fuzzy≈"{m.rawName}"</span>}
                    <span style={{fontSize:16,fontWeight:700,color:"#34d399"}}>{m.pts} <span style={{fontSize:10,color:"#2a5040"}}>pts</span></span>
                    <span style={{fontSize:10,color:tc.text,padding:"1px 8px",background:`${tc.bg}22`,border:`1px solid ${tc.bg}44`,borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif"}}>{picks[m.key]}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Matched but undrafted */}
          {preview.matched.filter(m=>!m.drafted).length>0&&(
            <div className="card" style={{marginBottom:11}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#93c5fd",letterSpacing:".08em"}}>ℹ FOUND BUT NOT DRAFTED</span>
              </div>
              <div style={{padding:"9px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                {preview.matched.filter(m=>!m.drafted).map((m,i)=>(
                  <span key={i} style={{fontSize:11,color:"#4a5060",fontFamily:"'Barlow Condensed',sans-serif",padding:"2px 8px",background:"#0d1219",border:"1px solid #1e2530",borderRadius:4}}>
                    {m.entry.name} ({m.entry.weight}lb) — {m.pts}pt
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched */}
          {preview.unmatched.length>0&&(
            <div className="card" style={{marginBottom:11}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#fca5a5",letterSpacing:".08em"}}>✗ COULD NOT MATCH</span>
                <span style={{fontSize:11,color:"#5a3030",fontFamily:"'Barlow Condensed',sans-serif",marginLeft:8}}>not in wrestler database</span>
              </div>
              <div style={{padding:"9px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                {preview.unmatched.map((u,i)=>(
                  <span key={i} style={{fontSize:11,color:"#7a4040",fontFamily:"'Barlow Condensed',sans-serif",padding:"2px 8px",background:"#1e0a0a",border:"1px solid #3a1515",borderRadius:4}}>{u.rawName} ({u.pts}pt)</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current scores table */}
      {draftedWrestlers.length>0&&(
        <div className="card" style={{marginTop:20}}>
          <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:13,fontWeight:600,color:"#c9a84c",letterSpacing:".08em"}}>CURRENT SCORES — ALL DRAFTED WRESTLERS</span>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{totalEntered}/{draftedWrestlers.length} have points · Grand total: <b style={{color:"#34d399"}}>{grandTotal.toFixed(1)}</b></span>
              <button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Clear all entered points?"))setPoints({});}}>CLEAR SCORES</button>
            </div>
          </div>
          {/* Manual single entry */}
          <div style={{padding:"8px 14px",borderBottom:"1px solid #1a1f26",background:"#08100c",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"#3a5030",letterSpacing:".12em"}}>MANUAL ENTRY:</span>
            <select value={manualKey} onChange={e=>setManualKey(e.target.value)}
              style={{flex:1,minWidth:200,padding:"5px 8px",background:"#070a0e",border:"1px solid #1e2530",borderRadius:5,color:"#d0c8b4",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif"}}>
              <option value="">— select wrestler —</option>
              {draftedWrestlers.map(w=>(
                <option key={w.key} value={w.key} style={{background:"#0d1117"}}>
                  {w.weight}lb #{w.seed} {w.name} ({w.team}) {w.pts>0?`— ${w.pts}pt`:""}
                </option>
              ))}
            </select>
            <input className="inp" type="number" step="0.5" min="0" max="100" value={manualPts}
              onChange={e=>setManualPts(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&applyManual()}
              placeholder="pts" style={{width:80,padding:"5px 8px",fontSize:13}}/>
            <button className="btn btn-primary btn-sm" onClick={applyManual} style={{padding:"5px 14px"}}>SET</button>
          </div>
          {/* Table */}
          {draftedWrestlers.map((wr,i)=>{
            const tc=getColor(wr.team);
            return (
              <div key={wr.key} className="wrow" style={{padding:"6px 14px",borderBottom:i<draftedWrestlers.length-1?"1px solid #0f1318":"none",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:28}}>{wr.weight}lb</span>
                <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{wr.seed}</span>
                <span style={{flex:1,fontSize:13,color:"#c0b898",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</span>
                <span style={{fontSize:10,color:tc.text,padding:"1px 7px",background:`${tc.bg}22`,border:`1px solid ${tc.bg}44`,borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{wr.team}</span>
                <span style={{fontSize:15,fontWeight:700,color:wr.pts>0?"#34d399":"#3a4040",minWidth:50,textAlign:"right"}}>{wr.pts>0?`${wr.pts}pt`:"—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({v,l,c,bg,bd}){
  return (
    <div style={{padding:"6px 14px",background:bg,border:`1px solid ${bd}`,borderRadius:6,textAlign:"center",minWidth:80}}>
      <div style={{fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
      <div style={{fontSize:8,color:c+"88",letterSpacing:".12em",marginTop:1}}>{l}</div>
    </div>
  );
}

// ─── STANDINGS PAGE ───────────────────────────────────────────────────────────
function StandingsPage({teamScores,getColor,getRoster}){
  const [expanded,setExpanded]=useState(null);
  const leader=teamScores[0]?.total||0;
  return (
    <div>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>LIVE STANDINGS</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Updates automatically as scores are imported</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {teamScores.map((ts,i)=>{
          const c=getColor(ts.team);const pct=leader>0?(ts.total/leader)*100:0;const isExp=expanded===ts.team;
          return (
            <div key={ts.team} className="card" style={{borderLeft:`4px solid ${c.bg}`}}>
              <div onClick={()=>setExpanded(isExp?null:ts.team)} style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <div className="rank-badge" style={{background:i===0?"radial-gradient(circle at 35% 35%,#e6c84e,#7a5810)":i===1?"radial-gradient(circle at 35% 35%,#aaa,#555)":i===2?"radial-gradient(circle at 35% 35%,#cd7f32,#7a4510)":"#1a1f26",color:i<3?"#070a0e":"#5a5030",boxShadow:i===0?"0 0 12px #c9a84c66":"none"}}>
                  {i+1}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:c.bg,boxShadow:`0 0 6px ${c.bg}`,flexShrink:0}}/>
                    <span style={{fontSize:17,fontWeight:600,color:c.text,letterSpacing:".05em"}}>{ts.team}</span>
                    <span style={{fontSize:11,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>{getRoster(ts.team).length} wrestlers</span>
                  </div>
                  <div style={{marginTop:6,height:4,background:"#1a1f26",borderRadius:2,overflow:"hidden"}}>
                    <div className="avail-bar" style={{height:"100%",width:`${pct}%`,background:c.bg,borderRadius:2,boxShadow:`0 0 6px ${c.bg}66`}}/>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:28,fontWeight:700,color:i===0?"#c9a84c":c.text,lineHeight:1}}>{ts.total.toFixed(1)}</div>
                  <div style={{fontSize:9,color:"#3a3820",letterSpacing:".12em"}}>POINTS</div>
                </div>
                <div style={{fontSize:14,color:"#3a3820"}}>{isExp?"▲":"▼"}</div>
              </div>
              {isExp&&(
                <div style={{borderTop:"1px solid #1a1f26",padding:"10px 16px"}}>
                  {ts.breakdown.length===0
                    ?<div style={{fontSize:12,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>No points yet — import scores on the Scores page</div>
                    :<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {ts.breakdown.sort((a,b)=>b.pts-a.pts).map(wr=>(
                        <div key={`${wr.weight}-${wr.seed}`} style={{padding:"5px 10px",background:`${c.bg}18`,border:`1px solid ${c.bg}33`,borderRadius:6,display:"flex",gap:7,alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.weight}#</span>
                          <span style={{fontSize:12,color:c.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>#{wr.seed} {wr.name}</span>
                          <span style={{fontSize:13,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DATA PAGE ────────────────────────────────────────────────────────────────
function SetupPage({teams,setTeams,picks,setPicks,setPoints,getRoster,getColor,draftTeam,setDraftTeam,showToast}){
  const [newName,setNewName]=useState("");
  const add=()=>{if(newName.trim()&&!teams.includes(newName.trim())){setTeams(p=>[...p,newName.trim()]);setNewName("");showToast("Team added","ok");}};
  return (
    <div style={{maxWidth:680}}>
      <div style={{marginBottom:22}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>DRAFT SETUP</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Manage teams · Snake draft order auto-applied</p>
      </div>
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>ADD TEAM</div>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Team name…"/>
          <button className="btn btn-primary btn-md" onClick={add}>ADD</button>
        </div>
      </div>
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:14}}>TEAMS ({teams.length}) — SNAKE ORDER</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {teams.map((t,i)=>{const c=getColor(t);const cnt=getRoster(t).length;return (
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#070a0e",border:`1px solid ${c.bg}33`,borderLeft:`4px solid ${c.bg}`,borderRadius:6}}>
              <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",minWidth:20,textAlign:"right"}}>#{i+1}</span>
              <div style={{width:8,height:8,borderRadius:"50%",background:c.bg,boxShadow:`0 0 5px ${c.bg}`,flexShrink:0}}/>
              <span style={{flex:1,fontSize:15,fontWeight:500,color:c.text,letterSpacing:".05em"}}>{t}</span>
              <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{cnt} pick{cnt!==1?"s":""}</span>
              <button className="undo-x" style={{fontSize:15}} onClick={()=>{setTeams(p=>p.filter(x=>x!==t));if(draftTeam===t)setDraftTeam(teams.find(x=>x!==t)||"");}}>✕</button>
            </div>
          );})}
        </div>
      </div>
      <div className="card" style={{padding:16,border:"1px solid #3a1515"}}>
        <div className="sec-label" style={{color:"#7a2020",marginBottom:10}}>DANGER ZONE</div>
        <button className="btn btn-danger btn-md" onClick={()=>{if(window.confirm("Clear all picks and scores?")){{setPicks({});setPoints({});showToast("Cleared","info");}}}}>CLEAR ALL PICKS & SCORES</button>
      </div>
    </div>
  );
}


// ─── ROSTER PAGE ──────────────────────────────────────────────────────────────
function RosterPage({team,roster,getColor,picksPerTeam,allWrestlers,picks,setPicks,
  wrestlers,bonusKeys,setBonusKeys,bonusPickEnabled,showToast}){
  const c=getColor(team);
  const total=roster.reduce((s,w)=>s+w.pts,0);

  // Classify first: bonus = in bonusKeys OR 2nd pick at same weight
  const primaryByWeight2={};
  const bonusPicks=[];
  roster.forEach(wr=>{
    const isManualBonus=bonusKeys.includes(wr.key);
    if(!isManualBonus&&WEIGHT_CLASSES.includes(wr.weight)&&!primaryByWeight2[wr.weight]){
      primaryByWeight2[wr.weight]=wr;
    } else {
      bonusPicks.push(wr);
    }
  });
  const covered=Object.keys(primaryByWeight2).length;

  // byW only shows non-bonus picks so weight slots appear vacant after →⭐
  const byW={};
  WEIGHT_CLASSES.forEach(w=>{byW[w]=roster.filter(r=>r.weight===w&&!bonusPicks.includes(r));});

  // ── Replace mode ──────────────────────────────────────────────────────────
  const [replaceTarget,setReplaceTarget]=useState(null);
  const [replaceQ,setReplaceQ]=useState("");
  const cancelReplace=()=>{setReplaceTarget(null);setReplaceQ("");};

  const undraftedWrestlers=useMemo(()=>{
    const list=[];
    [...WEIGHT_CLASSES,0].forEach(w=>(wrestlers[w]||[]).forEach(wr=>{
      if(!picks[pickKey(w,wr.seed)]) list.push({...wr,weight:w});
    }));
    return list;
  },[wrestlers,picks]);

  const replaceResults=useMemo(()=>{
    if(!replaceQ.trim()) return [];
    const q=replaceQ.toLowerCase();
    return undraftedWrestlers
      .filter(w=>w.name.toLowerCase().includes(q)||w.school.toLowerCase().includes(q))
      .slice(0,8);
  },[replaceQ,undraftedWrestlers]);

  const doReplace=(newWeight,newSeed)=>{
    if(!replaceTarget) return;
    const newKey=pickKey(newWeight,newSeed);
    // Hard guard — reject if anyone already has this key
    if(picks[newKey]){showToast("That wrestler is already drafted","err");return;}
    const oldKey=replaceTarget.key;
    setPicks(prev=>{const n={...prev};delete n[oldKey];n[newKey]=team;return n;});
    // Transfer bonus designation if applicable
    if(bonusKeys.includes(oldKey)){
      setBonusKeys(prev=>[...prev.filter(k=>k!==oldKey),newKey]);
    }
    const newWr=undraftedWrestlers.find(w=>w.weight===newWeight&&w.seed===newSeed);
    showToast(`${replaceTarget.name} → ${newWr?.name||"wrestler"}`,"ok");
    cancelReplace();
  };

  // Move primary → bonus: just add key to bonusKeys, pick stays intact
  const movePrimaryToBonus=(wr)=>{
    if(!bonusPickEnabled){showToast("Enable bonus picks in Settings first","err");return;}
    if(bonusKeys.includes(wr.key)) return;
    setBonusKeys(prev=>[...prev,wr.key]);
    showToast(`${wr.name} moved to ⭐ Bonus`,"info");
  };

  // Move bonus → weight: remove key from bonusKeys; check weight slot not already occupied
  const moveBonusToWeight=(wr)=>{
    const occupant=roster.find(r=>r.weight===wr.weight&&r.key!==wr.key&&!bonusKeys.includes(r.key));
    if(occupant){
      showToast(`${wr.weight}lb already has ${occupant.name} — use Replace first`,"err");
      return;
    }
    setBonusKeys(prev=>prev.filter(k=>k!==wr.key));
    showToast(`${wr.name} moved back to ${wr.weight}lb`,"ok");
  };

  // ── Hover state for button reveal ─────────────────────────────────────────
  const [hoveredKey,setHoveredKey]=useState(null);

  const WrCard=({wr,isBonus})=>{
    const isH=hoveredKey===wr.key;
    return (
      <div
        onMouseEnter={()=>setHoveredKey(wr.key)}
        onMouseLeave={()=>setHoveredKey(null)}
        style={{padding:"6px 8px",marginBottom:4,cursor:"default",borderRadius:6,
          background:isBonus?(isH?"#c9a84c22":"#c9a84c14"):(isH?`${c.bg}28`:`${c.bg}18`),
          border:`1px solid ${isBonus?"#c9a84c2e":c.bg+"2e"}`,
          transition:"background .12s"}}>
        {isBonus&&<div style={{fontSize:8,color:"#c9a84c88",letterSpacing:".1em",marginBottom:1}}>⭐ BONUS</div>}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",
            fontWeight:700,minWidth:18,flexShrink:0}}>#{wr.seed}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:isBonus?"#c9a84c":c.text,fontFamily:"'Barlow Condensed',sans-serif",
              fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</div>
            <div style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.school}</div>
          </div>
          {wr.pts>0&&!isH&&(
            <span style={{fontSize:11,fontWeight:700,color:"#34d399",flexShrink:0}}>{wr.pts}pt</span>
          )}
          {isH&&(
            <div style={{display:"flex",gap:3,flexShrink:0}}>
              <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                style={{fontSize:9,padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a4828",
                  borderRadius:4,color:"#2aaa64",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                  letterSpacing:".07em",cursor:"pointer",whiteSpace:"nowrap"}}>REPLACE</button>
              {!isBonus&&bonusPickEnabled&&(
                <button onClick={()=>movePrimaryToBonus(wr)}
                  title="Designate as bonus/dark horse pick"
                  style={{fontSize:9,padding:"2px 7px",background:"#181208",border:"1px solid #3a2e10",
                    borderRadius:4,color:"#c9a84c",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                    letterSpacing:".05em",cursor:"pointer",whiteSpace:"nowrap"}}>→⭐</button>
              )}
              {isBonus&&(
                <button onClick={()=>moveBonusToWeight(wr)}
                  title="Move back to weight class slot"
                  style={{fontSize:9,padding:"2px 7px",background:"#080e18",border:"1px solid #1a2e48",
                    borderRadius:4,color:"#6aa0d0",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                    letterSpacing:".05em",cursor:"pointer",whiteSpace:"nowrap"}}>←WT</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Replace mode panel ── */}
      {replaceTarget&&(
        <div style={{position:"sticky",top:0,zIndex:200,marginBottom:12,
          background:"#0d1520",border:"2px solid #c9a84c88",borderRadius:8,
          boxShadow:"0 8px 32px #000000cc",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:"#0a1018",borderBottom:"1px solid #c9a84c33",
            display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:".16em",color:"#8a7040",fontFamily:"'Oswald',sans-serif",marginBottom:2}}>
                REPLACING PICK
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#e0d8b4",fontFamily:"'Barlow Condensed',sans-serif"}}>
                {replaceTarget.name}
                <span style={{fontSize:10,color:"#4a4030",marginLeft:8,fontWeight:400}}>
                  {replaceTarget.weight>0?`${replaceTarget.weight}lb`:"Custom"} · #{replaceTarget.seed}
                </span>
              </div>
            </div>
            <button onClick={cancelReplace}
              style={{padding:"5px 12px",background:"transparent",border:"1px solid #3a3020",
                borderRadius:5,color:"#6a5a30",fontSize:11,fontFamily:"'Oswald',sans-serif",
                cursor:"pointer",letterSpacing:".08em"}}>CANCEL</button>
          </div>
          <div style={{padding:"10px 14px"}}>
            <input autoFocus value={replaceQ} onChange={e=>setReplaceQ(e.target.value)}
              placeholder="Search for replacement by name or school…"
              style={{width:"100%",padding:"9px 12px",background:"#070a0e",
                border:"1px solid #2a3040",borderRadius:6,color:"#d0c8b4",
                fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",boxSizing:"border-box"}}/>
            {replaceResults.length>0&&(
              <div style={{marginTop:6,background:"#070a0e",border:"1px solid #1e2a38",borderRadius:6,overflow:"hidden"}}>
                {replaceResults.map((wr,i)=>(
                  <button key={`${wr.weight}-${wr.seed}`} onClick={()=>doReplace(wr.weight,wr.seed)}
                    style={{width:"100%",padding:"9px 14px",display:"flex",alignItems:"center",gap:10,
                      background:"transparent",border:"none",
                      borderBottom:i<replaceResults.length-1?"1px solid #111820":"none",
                      cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#111820"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:38,flexShrink:0}}>
                      {wr.weight>0?`${wr.weight}lb`:"?"}
                    </span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:22,flexShrink:0}}>#{wr.seed}</span>
                    <span style={{flex:1,fontSize:14,color:"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{wr.name}</span>
                    <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.school}</span>
                    <span style={{fontSize:10,color:"#2a6a44",fontFamily:"'Oswald',sans-serif",fontWeight:700,flexShrink:0}}>SELECT</span>
                  </button>
                ))}
              </div>
            )}
            {replaceQ.trim()&&replaceResults.length===0&&(
              <div style={{marginTop:6,padding:"10px 14px",color:"#4a4030",fontSize:12,
                fontFamily:"'Barlow Condensed',sans-serif",background:"#070a0e",
                border:"1px solid #1e2a38",borderRadius:6}}>
                No undrafted wrestlers found matching "{replaceQ}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team header */}
      <div style={{padding:"16px 20px",marginBottom:16,
        background:`linear-gradient(135deg,${c.bg}1a 0%,#0b0f14 55%)`,
        border:`1px solid ${c.bg}33`,borderLeft:`5px solid ${c.bg}`,
        borderRadius:12,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{width:44,height:44,borderRadius:"50%",
          background:`radial-gradient(circle at 35% 35%,${c.bg},${c.bg}66)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:20,boxShadow:`0 0 18px ${c.glow}`,flexShrink:0}}>🏆</div>
        <div style={{flex:1}}>
          <div style={{fontSize:24,fontWeight:700,color:c.text,letterSpacing:".08em",lineHeight:1.1}}>{team.toUpperCase()}</div>
          <div style={{fontSize:10,color:"#4a4020",letterSpacing:".12em",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
            {roster.length}/{picksPerTeam} PICKS · {covered}/10 WEIGHTS · {total.toFixed(1)} PTS
          </div>
        </div>
        <div style={{fontSize:36,fontWeight:700,color:total>0?"#c9a84c":"#3a3820",lineHeight:1}}>
          {total.toFixed(1)}<span style={{fontSize:14,color:"#4a4030"}}> pts</span>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {WEIGHT_CLASSES.map(w=>(
            <div key={w} style={{padding:"3px 7px",borderRadius:4,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
              background:byW[w].length>0?`${c.bg}44`:"#1a1f26",border:`1px solid ${byW[w].length>0?c.bg:"#1e2530"}`,
              color:byW[w].length>0?c.text:"#2a3030"}}>
              {w===285?"HWT":w}
            </div>
          ))}
          <div style={{padding:"3px 7px",borderRadius:4,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
            background:bonusPicks.length>0?"#c9a84c33":"#1a1f26",border:`1px solid ${bonusPicks.length>0?"#c9a84c55":"#1e2530"}`,
            color:bonusPicks.length>0?"#c9a84c":"#2a3030"}}>⭐ BONUS</div>
        </div>
      </div>

      {/* Weight grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:12}}>
        {WEIGHT_CLASSES.map(w=>{
          const wrs=byW[w]||[];
          return (
            <div key={w} className="card" style={{borderTop:`3px solid ${wrs.length>0?c.bg:"#1e2530"}`}}>
              <div style={{padding:"8px 11px 6px",borderBottom:"1px solid #1a1f26",background:"#0d1219",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:20,fontWeight:700,color:"#c9a84c"}}>{w}</span>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>lbs</span>
              </div>
              <div style={{padding:8,minHeight:48}}>
                {wrs.length===0
                  ?<div style={{padding:"10px 0",textAlign:"center",color:"#1e2218",fontSize:11,fontFamily:"'Barlow Condensed',sans-serif"}}>— empty —</div>
                  :wrs.map(wr=><WrCard key={wr.key} wr={wr} isBonus={bonusPicks.includes(wr)}/>)
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Bonus / Dark Horse slot */}
      <div className="card" style={{marginBottom:16,borderTop:"3px solid #c9a84c"}}>
        <div style={{padding:"9px 16px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#c9a84c",letterSpacing:".1em"}}>⭐ BONUS / DARK HORSE PICK</span>
          <span style={{fontSize:11,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif"}}>hover any weight pick → click →⭐ to designate</span>
        </div>
        <div style={{padding:12}}>
          {bonusPicks.length===0
            ?<div style={{padding:"14px 0",textAlign:"center",color:"#3a3020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif"}}>
                No bonus pick yet — hover any weight pick and click →⭐
              </div>
            :bonusPicks.map((wr,i)=>{
              const isH=hoveredKey===wr.key;
              return (
                <div key={wr.key}
                  onMouseEnter={()=>setHoveredKey(wr.key)}
                  onMouseLeave={()=>setHoveredKey(null)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    background:isH?"#c9a84c28":"#c9a84c18",border:"1px solid #c9a84c33",
                    borderRadius:7,marginBottom:i<bonusPicks.length-1?6:0,
                    transition:"background .12s",cursor:"default"}}>
                  <span style={{fontSize:18}}>⭐</span>
                  <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:40}}>
                    {wr.weight>0?`${wr.weight}lb`:"?"}
                  </span>
                  <span style={{fontSize:10,color:"#5a5030",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{wr.seed}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:600,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.name}</span>
                  <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.school}</span>
                  {wr.pts>0&&!isH&&<span style={{fontSize:15,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>}
                  {isH&&(
                    <div style={{display:"flex",gap:3,flexShrink:0}}>
                      <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                        style={{fontSize:9,padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a4828",
                          borderRadius:4,color:"#2aaa64",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                          letterSpacing:".07em",cursor:"pointer"}}>REPLACE</button>
                      <button onClick={()=>moveBonusToWeight(wr)}
                        title="Move back to weight class slot"
                        style={{fontSize:9,padding:"2px 7px",background:"#080e18",border:"1px solid #1a2e48",
                          borderRadius:4,color:"#6aa0d0",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                          letterSpacing:".05em",cursor:"pointer"}}>←WT</button>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Full pick log */}
      {roster.length>0&&(
        <div className="card" style={{padding:16}}>
          <div className="sec-label" style={{marginBottom:12}}>ALL {roster.length} PICKS — {team}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {[...roster].sort((a,b)=>b.pts-a.pts||a.seed-b.seed).map(wr=>{
              const isB=bonusPicks.includes(wr);const isH=hoveredKey===wr.key;
              return (
                <div key={wr.key}
                  onMouseEnter={()=>setHoveredKey(wr.key)}
                  onMouseLeave={()=>setHoveredKey(null)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",
                    background:isB?(isH?"#c9a84c28":"#c9a84c18"):(isH?`${c.bg}28`:`${c.bg}18`),
                    border:`1px solid ${isB?"#c9a84c33":c.bg+"33"}`,borderRadius:6,
                    cursor:"default",transition:"background .12s"}}>
                  {isB&&<span style={{fontSize:10}}>⭐</span>}
                  <span style={{fontSize:9,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>
                    {wr.weight>0?`${wr.weight}#`:"?"}
                  </span>
                  <span style={{fontSize:12,color:isB?"#c9a84c":c.text,fontFamily:"'Barlow Condensed',sans-serif"}}>
                    #{wr.seed} {wr.name}
                  </span>
                  {wr.pts>0&&!isH&&<span style={{fontSize:11,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>}
                  {isH&&(
                    <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                      style={{fontSize:9,padding:"1px 6px",background:"transparent",border:"1px solid #2a3820",
                        borderRadius:3,color:"#4a8060",fontFamily:"'Oswald',sans-serif",cursor:"pointer",letterSpacing:".05em"}}>
                      ↺ REPLACE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
