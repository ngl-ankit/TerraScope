/**
 * Reference coordinates for the flight search catalogue.
 *
 * These are approximate airport reference points used only to centre the
 * OpenSky bounding-box query and to let the user search "Heathrow" instead of
 * typing a latitude. They are not a navigation dataset and are labelled as such
 * in the UI.
 */
export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export const AIRPORTS: Airport[] = [
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield–Jackson Atlanta International', city: 'Atlanta', country: 'United States', lat: 33.6407, lon: -84.4277 },
  { iata: 'PEK', icao: 'ZBAA', name: 'Beijing Capital International', city: 'Beijing', country: 'China', lat: 40.0799, lon: 116.6031 },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', lat: 33.9416, lon: -118.4085 },
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lon: 55.3657 },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798 },
  { iata: 'ORD', icao: 'KORD', name: "O'Hare International", city: 'Chicago', country: 'United States', lat: 41.9742, lon: -87.9073 },
  { iata: 'LHR', icao: 'EGLL', name: 'Heathrow', city: 'London', country: 'United Kingdom', lat: 51.47, lon: -0.4543 },
  { iata: 'CDG', icao: 'LFPG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
  { iata: 'DFW', icao: 'KDFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'United States', lat: 32.8998, lon: -97.0403 },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt am Main', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
  { iata: 'AMS', icao: 'EHAM', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lon: 4.7683 },
  { iata: 'IST', icao: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', country: 'Türkiye', lat: 41.2753, lon: 28.7519 },
  { iata: 'JFK', icao: 'KJFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', lat: 40.6413, lon: -73.7781 },
  { iata: 'SIN', icao: 'WSSS', name: 'Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
  { iata: 'ICN', icao: 'RKSI', name: 'Incheon International', city: 'Seoul', country: 'South Korea', lat: 37.4602, lon: 126.4407 },
  { iata: 'DEN', icao: 'KDEN', name: 'Denver International', city: 'Denver', country: 'United States', lat: 39.8561, lon: -104.6737 },
  { iata: 'HKG', icao: 'VHHH', name: 'Hong Kong International', city: 'Hong Kong', country: 'China', lat: 22.308, lon: 113.9185 },
  { iata: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand', lat: 13.69, lon: 100.7501 },
  { iata: 'MAD', icao: 'LEMD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', country: 'Spain', lat: 40.4936, lon: -3.5668 },
  { iata: 'BCN', icao: 'LEBL', name: 'Josep Tarradellas Barcelona–El Prat', city: 'Barcelona', country: 'Spain', lat: 41.2974, lon: 2.0833 },
  { iata: 'SFO', icao: 'KSFO', name: 'San Francisco International', city: 'San Francisco', country: 'United States', lat: 37.6213, lon: -122.379 },
  { iata: 'SEA', icao: 'KSEA', name: 'Seattle–Tacoma International', city: 'Seattle', country: 'United States', lat: 47.4502, lon: -122.3088 },
  { iata: 'MIA', icao: 'KMIA', name: 'Miami International', city: 'Miami', country: 'United States', lat: 25.7959, lon: -80.287 },
  { iata: 'BOS', icao: 'KBOS', name: 'Logan International', city: 'Boston', country: 'United States', lat: 42.3656, lon: -71.0096 },
  { iata: 'IAH', icao: 'KIAH', name: 'George Bush Intercontinental', city: 'Houston', country: 'United States', lat: 29.9902, lon: -95.3368 },
  { iata: 'PHX', icao: 'KPHX', name: 'Sky Harbor International', city: 'Phoenix', country: 'United States', lat: 33.4342, lon: -112.0116 },
  { iata: 'LAS', icao: 'KLAS', name: 'Harry Reid International', city: 'Las Vegas', country: 'United States', lat: 36.084, lon: -115.1537 },
  { iata: 'MCO', icao: 'KMCO', name: 'Orlando International', city: 'Orlando', country: 'United States', lat: 28.4312, lon: -81.3081 },
  { iata: 'EWR', icao: 'KEWR', name: 'Newark Liberty International', city: 'Newark', country: 'United States', lat: 40.6895, lon: -74.1745 },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada', lat: 43.6777, lon: -79.6248 },
  { iata: 'YVR', icao: 'CYVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada', lat: 49.1967, lon: -123.1815 },
  { iata: 'YUL', icao: 'CYUL', name: 'Montréal–Trudeau International', city: 'Montréal', country: 'Canada', lat: 45.4706, lon: -73.7408 },
  { iata: 'MEX', icao: 'MMMX', name: 'Benito Juárez International', city: 'Mexico City', country: 'Mexico', lat: 19.4361, lon: -99.0719 },
  { iata: 'GRU', icao: 'SBGR', name: 'Guarulhos International', city: 'São Paulo', country: 'Brazil', lat: -23.4356, lon: -46.4731 },
  { iata: 'GIG', icao: 'SBGL', name: 'Galeão International', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.8099, lon: -43.2506 },
  { iata: 'EZE', icao: 'SAEZ', name: 'Ezeiza International', city: 'Buenos Aires', country: 'Argentina', lat: -34.8222, lon: -58.5358 },
  { iata: 'SCL', icao: 'SCEL', name: 'Arturo Merino Benítez International', city: 'Santiago', country: 'Chile', lat: -33.393, lon: -70.7858 },
  { iata: 'BOG', icao: 'SKBO', name: 'El Dorado International', city: 'Bogotá', country: 'Colombia', lat: 4.7016, lon: -74.1469 },
  { iata: 'LIM', icao: 'SPJC', name: 'Jorge Chávez International', city: 'Lima', country: 'Peru', lat: -12.0219, lon: -77.1143 },
  { iata: 'PTY', icao: 'MPTO', name: 'Tocumen International', city: 'Panama City', country: 'Panama', lat: 9.0714, lon: -79.3835 },
  { iata: 'DUB', icao: 'EIDW', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', lat: 53.4213, lon: -6.2701 },
  { iata: 'MAN', icao: 'EGCC', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom', lat: 53.3537, lon: -2.275 },
  { iata: 'EDI', icao: 'EGPH', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', lat: 55.95, lon: -3.3725 },
  { iata: 'LGW', icao: 'EGKK', name: 'Gatwick', city: 'London', country: 'United Kingdom', lat: 51.1537, lon: -0.1821 },
  { iata: 'BRU', icao: 'EBBR', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', lat: 50.9014, lon: 4.4844 },
  { iata: 'ZRH', icao: 'LSZH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4647, lon: 8.5492 },
  { iata: 'GVA', icao: 'LSGG', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', lat: 46.2381, lon: 6.1089 },
  { iata: 'VIE', icao: 'LOWW', name: 'Vienna International', city: 'Vienna', country: 'Austria', lat: 48.1103, lon: 16.5697 },
  { iata: 'MUC', icao: 'EDDM', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3538, lon: 11.7861 },
  { iata: 'BER', icao: 'EDDB', name: 'Berlin Brandenburg', city: 'Berlin', country: 'Germany', lat: 52.3667, lon: 13.5033 },
  { iata: 'DUS', icao: 'EDDL', name: 'Düsseldorf Airport', city: 'Düsseldorf', country: 'Germany', lat: 51.2895, lon: 6.7668 },
  { iata: 'CPH', icao: 'EKCH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.618, lon: 12.6508 },
  { iata: 'ARN', icao: 'ESSA', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'Sweden', lat: 59.6519, lon: 17.9186 },
  { iata: 'OSL', icao: 'ENGM', name: 'Oslo Gardermoen', city: 'Oslo', country: 'Norway', lat: 60.1939, lon: 11.1004 },
  { iata: 'HEL', icao: 'EFHK', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'Finland', lat: 60.3172, lon: 24.9633 },
  { iata: 'KEF', icao: 'BIKF', name: 'Keflavík International', city: 'Reykjavík', country: 'Iceland', lat: 63.985, lon: -22.6056 },
  { iata: 'LIS', icao: 'LPPT', name: 'Humberto Delgado', city: 'Lisbon', country: 'Portugal', lat: 38.7742, lon: -9.1342 },
  { iata: 'OPO', icao: 'LPPR', name: 'Francisco Sá Carneiro', city: 'Porto', country: 'Portugal', lat: 41.2481, lon: -8.6814 },
  { iata: 'FCO', icao: 'LIRF', name: 'Leonardo da Vinci–Fiumicino', city: 'Rome', country: 'Italy', lat: 41.8003, lon: 12.2389 },
  { iata: 'MXP', icao: 'LIMC', name: 'Malpensa', city: 'Milan', country: 'Italy', lat: 45.6306, lon: 8.7281 },
  { iata: 'ATH', icao: 'LGAV', name: 'Athens International', city: 'Athens', country: 'Greece', lat: 37.9364, lon: 23.9445 },
  { iata: 'WAW', icao: 'EPWA', name: 'Warsaw Chopin', city: 'Warsaw', country: 'Poland', lat: 52.1657, lon: 20.9671 },
  { iata: 'PRG', icao: 'LKPR', name: 'Václav Havel Prague', city: 'Prague', country: 'Czechia', lat: 50.1008, lon: 14.26 },
  { iata: 'BUD', icao: 'LHBP', name: 'Budapest Ferenc Liszt', city: 'Budapest', country: 'Hungary', lat: 47.4369, lon: 19.2556 },
  { iata: 'OTP', icao: 'LROP', name: 'Henri Coandă International', city: 'Bucharest', country: 'Romania', lat: 44.5711, lon: 26.085 },
  { iata: 'SVO', icao: 'UUEE', name: 'Sheremetyevo International', city: 'Moscow', country: 'Russia', lat: 55.9726, lon: 37.4146 },
  { iata: 'LED', icao: 'ULLI', name: 'Pulkovo', city: 'Saint Petersburg', country: 'Russia', lat: 59.8003, lon: 30.2625 },
  { iata: 'KBP', icao: 'UKBB', name: 'Boryspil International', city: 'Kyiv', country: 'Ukraine', lat: 50.345, lon: 30.8947 },
  { iata: 'TLV', icao: 'LLBG', name: 'Ben Gurion', city: 'Tel Aviv', country: 'Israel', lat: 32.0114, lon: 34.8867 },
  { iata: 'CAI', icao: 'HECA', name: 'Cairo International', city: 'Cairo', country: 'Egypt', lat: 30.1219, lon: 31.4056 },
  { iata: 'JNB', icao: 'FAOR', name: 'O. R. Tambo International', city: 'Johannesburg', country: 'South Africa', lat: -26.1392, lon: 28.246 },
  { iata: 'CPT', icao: 'FACT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa', lat: -33.9649, lon: 18.6017 },
  { iata: 'NBO', icao: 'HKJK', name: 'Jomo Kenyatta International', city: 'Nairobi', country: 'Kenya', lat: -1.3192, lon: 36.9278 },
  { iata: 'ADD', icao: 'HAAB', name: 'Bole International', city: 'Addis Ababa', country: 'Ethiopia', lat: 8.9779, lon: 38.7993 },
  { iata: 'LOS', icao: 'DNMM', name: 'Murtala Muhammed International', city: 'Lagos', country: 'Nigeria', lat: 6.5774, lon: 3.3212 },
  { iata: 'CMN', icao: 'GMMN', name: 'Mohammed V International', city: 'Casablanca', country: 'Morocco', lat: 33.3675, lon: -7.5899 },
  { iata: 'ALG', icao: 'DAAG', name: 'Houari Boumediene', city: 'Algiers', country: 'Algeria', lat: 36.691, lon: 3.2154 },
  { iata: 'DOH', icao: 'OTHH', name: 'Hamad International', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6081 },
  { iata: 'AUH', icao: 'OMAA', name: 'Zayed International', city: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.433, lon: 54.6511 },
  { iata: 'RUH', icao: 'OERK', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.9576, lon: 46.6988 },
  { iata: 'JED', icao: 'OEJN', name: 'King Abdulaziz International', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.6796, lon: 39.1565 },
  { iata: 'KWI', icao: 'OKBK', name: 'Kuwait International', city: 'Kuwait City', country: 'Kuwait', lat: 29.2266, lon: 47.9689 },
  { iata: 'BOM', icao: 'VABB', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India', lat: 19.0896, lon: 72.8656 },
  { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi International', city: 'Delhi', country: 'India', lat: 28.5562, lon: 77.1 },
  { iata: 'BLR', icao: 'VOBL', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', lat: 13.1986, lon: 77.7066 },
  { iata: 'MAA', icao: 'VOMM', name: 'Chennai International', city: 'Chennai', country: 'India', lat: 12.9941, lon: 80.1709 },
  { iata: 'HYD', icao: 'VOHS', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', lat: 17.2403, lon: 78.4294 },
  { iata: 'CCU', icao: 'VECC', name: 'Netaji Subhas Chandra Bose International', city: 'Kolkata', country: 'India', lat: 22.6547, lon: 88.4467 },
  { iata: 'CMB', icao: 'VCBI', name: 'Bandaranaike International', city: 'Colombo', country: 'Sri Lanka', lat: 7.1808, lon: 79.8841 },
  { iata: 'KTM', icao: 'VNKT', name: 'Tribhuvan International', city: 'Kathmandu', country: 'Nepal', lat: 27.6966, lon: 85.3591 },
  { iata: 'DAC', icao: 'VGHS', name: 'Hazrat Shahjalal International', city: 'Dhaka', country: 'Bangladesh', lat: 23.8433, lon: 90.3978 },
  { iata: 'KUL', icao: 'WMKK', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lon: 101.7099 },
  { iata: 'CGK', icao: 'WIII', name: 'Soekarno–Hatta International', city: 'Jakarta', country: 'Indonesia', lat: -6.1256, lon: 106.6558 },
  { iata: 'DPS', icao: 'WADD', name: 'Ngurah Rai International', city: 'Denpasar', country: 'Indonesia', lat: -8.7482, lon: 115.1672 },
  { iata: 'MNL', icao: 'RPLL', name: 'Ninoy Aquino International', city: 'Manila', country: 'Philippines', lat: 14.5086, lon: 121.0194 },
  { iata: 'SGN', icao: 'VVTS', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8188, lon: 106.652 },
  { iata: 'HAN', icao: 'VVNB', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', lat: 21.2212, lon: 105.8072 },
  { iata: 'TPE', icao: 'RCTP', name: 'Taiwan Taoyuan International', city: 'Taipei', country: 'Taiwan', lat: 25.0777, lon: 121.2328 },
  { iata: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', lat: 31.1443, lon: 121.8083 },
  { iata: 'CAN', icao: 'ZGGG', name: 'Guangzhou Baiyun International', city: 'Guangzhou', country: 'China', lat: 23.3924, lon: 113.2988 },
  { iata: 'SZX', icao: 'ZGSZ', name: 'Shenzhen Bao\'an International', city: 'Shenzhen', country: 'China', lat: 22.6393, lon: 113.8106 },
  { iata: 'CTU', icao: 'ZUUU', name: 'Chengdu Shuangliu International', city: 'Chengdu', country: 'China', lat: 30.5785, lon: 103.9471 },
  { iata: 'XIY', icao: 'ZLXY', name: "Xi'an Xianyang International", city: "Xi'an", country: 'China', lat: 34.4471, lon: 108.7516 },
  { iata: 'NRT', icao: 'RJAA', name: 'Narita International', city: 'Tokyo', country: 'Japan', lat: 35.772, lon: 140.3929 },
  { iata: 'KIX', icao: 'RJBB', name: 'Kansai International', city: 'Osaka', country: 'Japan', lat: 34.4347, lon: 135.244 },
  { iata: 'NGO', icao: 'RJGG', name: 'Chubu Centrair International', city: 'Nagoya', country: 'Japan', lat: 34.8584, lon: 136.8054 },
  { iata: 'CTS', icao: 'RJCC', name: 'New Chitose', city: 'Sapporo', country: 'Japan', lat: 42.7752, lon: 141.6923 },
  { iata: 'GMP', icao: 'RKSS', name: 'Gimpo International', city: 'Seoul', country: 'South Korea', lat: 37.5583, lon: 126.7906 },
  { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', lat: -33.9399, lon: 151.1753 },
  { iata: 'MEL', icao: 'YMML', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', lat: -37.669, lon: 144.841 },
  { iata: 'BNE', icao: 'YBBN', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', lat: -27.3842, lon: 153.1175 },
  { iata: 'PER', icao: 'YPPH', name: 'Perth Airport', city: 'Perth', country: 'Australia', lat: -31.9403, lon: 115.9669 },
  { iata: 'AKL', icao: 'NZAA', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', lat: -37.0082, lon: 174.785 },
  { iata: 'HNL', icao: 'PHNL', name: 'Daniel K. Inouye International', city: 'Honolulu', country: 'United States', lat: 21.3187, lon: -157.9224 },
  { iata: 'ANC', icao: 'PANC', name: 'Ted Stevens Anchorage International', city: 'Anchorage', country: 'United States', lat: 61.1743, lon: -149.9962 },
  { iata: 'MSY', icao: 'KMSY', name: 'Louis Armstrong New Orleans International', city: 'New Orleans', country: 'United States', lat: 29.9934, lon: -90.258 },
  { iata: 'AUS', icao: 'KAUS', name: 'Austin–Bergstrom International', city: 'Austin', country: 'United States', lat: 30.1975, lon: -97.6664 },
  { iata: 'SAN', icao: 'KSAN', name: 'San Diego International', city: 'San Diego', country: 'United States', lat: 32.7338, lon: -117.1933 },
  { iata: 'TPA', icao: 'KTPA', name: 'Tampa International', city: 'Tampa', country: 'United States', lat: 27.9755, lon: -82.5332 },
  { iata: 'PDX', icao: 'KPDX', name: 'Portland International', city: 'Portland', country: 'United States', lat: 45.5898, lon: -122.5951 },
  { iata: 'SLC', icao: 'KSLC', name: 'Salt Lake City International', city: 'Salt Lake City', country: 'United States', lat: 40.7899, lon: -111.9791 },
  { iata: 'MSP', icao: 'KMSP', name: 'Minneapolis–Saint Paul International', city: 'Minneapolis', country: 'United States', lat: 44.8848, lon: -93.2223 },
  { iata: 'DTW', icao: 'KDTW', name: 'Detroit Metropolitan', city: 'Detroit', country: 'United States', lat: 42.2162, lon: -83.3554 },
  { iata: 'PHL', icao: 'KPHL', name: 'Philadelphia International', city: 'Philadelphia', country: 'United States', lat: 39.8744, lon: -75.2424 },
  { iata: 'BWI', icao: 'KBWI', name: 'Baltimore/Washington International', city: 'Baltimore', country: 'United States', lat: 39.1774, lon: -76.6684 },
  { iata: 'DCA', icao: 'KDCA', name: 'Ronald Reagan Washington National', city: 'Washington', country: 'United States', lat: 38.8512, lon: -77.0402 },
  { iata: 'IAD', icao: 'KIAD', name: 'Washington Dulles International', city: 'Washington', country: 'United States', lat: 38.9531, lon: -77.4565 },
  { iata: 'CLT', icao: 'KCLT', name: 'Charlotte Douglas International', city: 'Charlotte', country: 'United States', lat: 35.214, lon: -80.9431 },
  { iata: 'CUN', icao: 'MMUN', name: 'Cancún International', city: 'Cancún', country: 'Mexico', lat: 21.0365, lon: -86.8771 },
  { iata: 'HAV', icao: 'MUHA', name: 'José Martí International', city: 'Havana', country: 'Cuba', lat: 22.9892, lon: -82.4091 },
  { iata: 'KIN', icao: 'MKJP', name: 'Norman Manley International', city: 'Kingston', country: 'Jamaica', lat: 17.9357, lon: -76.7875 },
  { iata: 'SDQ', icao: 'MDSD', name: 'Las Américas International', city: 'Santo Domingo', country: 'Dominican Republic', lat: 18.4297, lon: -69.6689 },
  { iata: 'BSB', icao: 'SBBR', name: 'Brasília International', city: 'Brasília', country: 'Brazil', lat: -15.8697, lon: -47.9208 },
  { iata: 'CNF', icao: 'SBCF', name: 'Tancredo Neves International', city: 'Belo Horizonte', country: 'Brazil', lat: -19.6244, lon: -43.9719 },
  { iata: 'MVD', icao: 'SUMU', name: 'Carrasco International', city: 'Montevideo', country: 'Uruguay', lat: -34.8384, lon: -56.0308 },
  { iata: 'UIO', icao: 'SEQM', name: 'Mariscal Sucre International', city: 'Quito', country: 'Ecuador', lat: -0.1292, lon: -78.3575 },
  { iata: 'CCS', icao: 'SVMI', name: 'Simón Bolívar International', city: 'Caracas', country: 'Venezuela', lat: 10.6012, lon: -66.9912 },
  { iata: 'DKR', icao: 'GOBD', name: 'Blaise Diagne International', city: 'Dakar', country: 'Senegal', lat: 14.6708, lon: -17.0733 },
  { iata: 'ACC', icao: 'DGAA', name: 'Kotoka International', city: 'Accra', country: 'Ghana', lat: 5.6052, lon: -0.1668 },
  { iata: 'TUN', icao: 'DTTA', name: 'Tunis–Carthage International', city: 'Tunis', country: 'Tunisia', lat: 36.851, lon: 10.2272 },
  { iata: 'AMM', icao: 'OJAI', name: 'Queen Alia International', city: 'Amman', country: 'Jordan', lat: 31.7226, lon: 35.9932 },
  { iata: 'BEY', icao: 'OLBA', name: 'Beirut–Rafic Hariri International', city: 'Beirut', country: 'Lebanon', lat: 33.8209, lon: 35.4884 },
  { iata: 'BAH', icao: 'OBBI', name: 'Bahrain International', city: 'Manama', country: 'Bahrain', lat: 26.2708, lon: 50.6336 },
  { iata: 'MCT', icao: 'OOMS', name: 'Muscat International', city: 'Muscat', country: 'Oman', lat: 23.5933, lon: 58.2844 },
  { iata: 'KHI', icao: 'OPKC', name: 'Jinnah International', city: 'Karachi', country: 'Pakistan', lat: 24.9065, lon: 67.1608 },
  { iata: 'LHE', icao: 'OPLA', name: 'Allama Iqbal International', city: 'Lahore', country: 'Pakistan', lat: 31.5216, lon: 74.4036 },
  { iata: 'ISB', icao: 'OPIS', name: 'Islamabad International', city: 'Islamabad', country: 'Pakistan', lat: 33.5607, lon: 72.8516 },
  { iata: 'TAS', icao: 'UTTT', name: 'Islam Karimov Tashkent International', city: 'Tashkent', country: 'Uzbekistan', lat: 41.2579, lon: 69.2812 },
  { iata: 'ALA', icao: 'UAAA', name: 'Almaty International', city: 'Almaty', country: 'Kazakhstan', lat: 43.3521, lon: 77.0405 },
  { iata: 'ULN', icao: 'ZMUB', name: 'Chinggis Khaan International', city: 'Ulaanbaatar', country: 'Mongolia', lat: 47.8431, lon: 106.7664 },
  { iata: 'POM', icao: 'AYPY', name: 'Jacksons International', city: 'Port Moresby', country: 'Papua New Guinea', lat: -9.4434, lon: 147.22 },
  { iata: 'NAN', icao: 'NFFN', name: 'Nadi International', city: 'Nadi', country: 'Fiji', lat: -17.7554, lon: 177.4434 },
];

/** Look up an airport by IATA/ICAO code or by a substring of its name/city. */
export function findAirports(query: string, limit = 5): Airport[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const scored = AIRPORTS.map((airport) => {
    const iata = airport.iata.toLowerCase();
    const icao = airport.icao.toLowerCase();
    const name = airport.name.toLowerCase();
    const city = airport.city.toLowerCase();

    let score = 0;
    if (iata === needle || icao === needle) score = 100;
    else if (city === needle) score = 90;
    else if (city.startsWith(needle)) score = 70;
    else if (name.includes(needle)) score = 50;
    else if (city.includes(needle)) score = 40;
    else if (airport.country.toLowerCase().startsWith(needle)) score = 20;
    return { airport, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.airport);
}
