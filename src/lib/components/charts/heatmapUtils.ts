// Helper function to get category for activity code
function getActivityCategory(activityCode: string): string {
    if (activityCode.includes('meal') || activityCode.includes('food') || activityCode.includes('Eating') || activityCode.includes('Drinking')) {
      return 'Food';
    } else if (activityCode.includes('sleep') || activityCode.includes('rest') || activityCode.includes('relax')) {
      return 'Sleep';
    } else if (activityCode.includes('child') || activityCode.includes('baby') || activityCode.includes('dependent')) {
      return 'Care';
    } else if (activityCode.includes('travel') || activityCode.includes('transport') || activityCode.includes('moving')) {
      return 'Travel';
    } else if (activityCode.includes('clean') || activityCode.includes('wash') || activityCode.includes('hygiene')) {
      return 'Hygiene';
    } else if (activityCode.includes('leisure') || activityCode.includes('hobby') || activityCode.includes('game') || activityCode.includes('sport')) {
      return 'Leisure';
    } else if (activityCode.includes('work') || activityCode.includes('employment') || activityCode.includes('business')) {
      return 'Work';
    } else if (activityCode.includes('education') || activityCode.includes('school') || activityCode.includes('study')) {
      return 'Education';
    } else if (activityCode.includes('repair') || activityCode.includes('maintenance')) {
      return 'Repair';
    } else {
      return 'Other';
    }
  }
  
  // Helper function to get emoji for activity code
  function getActivityEmoji(activityCode: string): string {
    // Map activity codes to appropriate emojis
    const activityEmojiMap: Record<string, string> = {
      // Food related
      'Preparing meals/snacks': '👨‍🍳',
      'Serving meals/snacks': '🍽️',
      'Cleaning up after food preparation/meals/snacks': '🧽',
      'Other activities related to food and meals management and preparation': '🥘',
      'Eating meals/snack': '🍲',
      'Drinking other than with meal or snack': '🧉',
      'Storing, arranging, preserving food stocks': '🏺',
      
      // Shopping related
      'Shopping for/purchasing of goods and related activities': '🛒',
      'Shopping for/availing of services and related activity': '💳',
      
      // Leisure and recreation
      'Reading for leisure': '📗',
      'Playing games and other pastime activities': '🎲',
      'Hobbies': '🧩',
      'Watching/listening to television and video': '📺',
      'Listening to radio and audio devices': '🎧',
      'Culture, leisure, mass-media and sports practices': '🎭',
      'Other activities related to culture, leisure, mass-media and sports practices': '🎨',
      'Other activities related to mass media use': '📱',
      'Visual, literary and performing arts (as hobby)': '🎻',
      
      // Maintenance and repair
      'Providing paid repair, installation, maintenance and disposal in household enterprises': '🔧',
      'Do-it-yourself improvement, maintenance and repair of own dwelling': '🪚',
      'Vehicle maintenance and repairs': '🔩',
      'Other activities related to do-it-yourself decoration, maintenance and repair': '🧰',
      'Installation, servicing and repair of personal and household goods including ICT equipment': '⚙️',
      
      // Personal care
      'Personal hygiene and care': '🚿',
      'Other activities related to personal hygiene and care': '💄',
      'Health/medical care to oneself': '💊',
      'Receiving health/medical care from others': '🩺',
      'Other activities related to receiving personal and health/medical care': '⚕️',
      'Receiving personal care from others': '💆',
      
      // Childcare and care for others
      'Providing medical care to children': '🩹',
      'Caring for children including feeding, cleaning, physical care': '👶',
      'Minding children (passive care)': '🧸',
      'Talking with and reading to children': '📖',
      'Playing and sports with children': '🎯',
      'Instructing, teaching, training, helping children': '✏️',
      'Accompanying own children': '🚸',
      'Other activities related to childcare and instruction': '👨‍👧‍👦',
      'Accompanying dependent adults': '👴',
      'Accompanying non-dependent adult household members': '👫',
      'Feeding, cleaning, physical care for non-dependent adult household members including for temporary illness': '🥄',
      'Assisting dependent adults with forms, administration, accounts': '📋',
      'Assisting dependent adults with medical care': '🩺',
      'Affective/emotional support for dependent adults': '🤗',
      'Affective/emotional support for non-dependent adult household members': '💝',
      
      // Water and resources
      'Fetching water from natural and other sources for own final use': '🪣',
      'Gathering firewood and other natural products used as fuel for own final use': '🪵',
      'Gathering wild products for own final use': '🍄',
      
      // Sleep and rest
      'Night sleep/essential sleep': '🛌',
      'Incidental sleep/naps': '💤',
      'Other sleep and related activities': '🦥',
      'Sleeplessness': '🌃',
      'Activities associated with reflecting, resting, relaxing': '🧘',
      
      // Agricultural activities
      'Farming of animals and production of animal products for own final use': '🐄',
      'Growing crops and kitchen gardening, for own final use': '🌱',
      'Aquaculture for own final use': '🐟',
      'Forestry and logging for own final use': '🪓',
      'Growing of crops for the market in household enterprises': '🌾',
      'Raising animals for the market in household enterprises': '🐖',
      'Aquaculture for the market in household enterprises': '🦑',
      'Forestry and logging for the market in household enterprises': '🌲',
      
      // Accommodation
      'Construction activities for the market in household enterprises': '🏗️',
      'Construction activities for own final use': '🏠',
      'Indoor cleaning': '🧹',
      'Outdoor cleaning': '🪥',
      
      // Manufacturing and processing
      'Making and processing goods for the market in household enterprises': '🏭',
      'Making, processing of products using other materials for own final use': '⚒️',
      'Making, processing textiles, wearing apparel, leather and related products for own final use': '🧵',
      'Making, processing of wood and bark products for own final use': '🪑',
      'Making, processing metals and metal products for own final use': '🔨',
      'Making, processing food products, beverages and tobacco for own final use': '🫕',
      'Making, processing herbal and medicinal preparations for own final use': '🧪',
      'Making, processing bricks, concrete slabs, hollow blocks, tiles for own final use': '🧱',
      
      // Exercise and sports
      'Exercising': '🏋️',
      'Participating in sports': '🏊',
      
      // Household and domestic
      'Other unpaid domestic services for household members': '🧺',
      'Hand/machine-washing': '👚',
      'Ironing/pressing/folding': '🗄️',
      'Drying textiles and clothing': '☀️',
      'Mending/repairing and care of clothes and shoes; cleaning and polishing shoes': '👞',
      'Upkeep of indoor/outdoor plants, hedges, garden, grounds, landscape, etc.': '🌻',
      'Other activities related to cleaning and upkeep of dwelling and surroundings': '🧼',
      'Other activities related to care of textiles and footwear': '🧦',
      'Recycling and disposal of garbage': '♻️',
      'Tending furnace, boiler, fireplace for heating and water supply': '🔥',
      
      // Community and volunteering
      'Unpaid volunteer work on road/building repair, clearing and preparing land, cleaning (streets, markets, etc.), and construction': '🛠️',
      'Unpaid volunteer cultural activities, recreation and sports activities': '🎪',
      'Unpaid volunteer activities in enterprises owned by other households': '🤲',
      'Unpaid volunteer preparing/serving meals, cleaning up': '🥗',
      'Unpaid volunteer childcare and instruction': '🎒',
      'Unpaid volunteer shopping/purchasing goods and services': '🛍️',
      'Unpaid volunteer household maintenance, management, construction, renovation and repair': '🏗️',
      'Unpaid volunteer office/administrative work': '📊',
      'Unpaid volunteer care for adults': '🧑‍⚕️',
      
      // Transportation
      'Transporting goods and passengers for pay or profit in household enterprises': '🚛',
      'Travelling, moving, transporting or accompanying goods or persons related to unpaid domestic services for household members': '🚙',
      'Travelling time related to socializing and communication, community participation and religious practice': '🚶',
      'Travelling time related to self-care and maintenance activities': '🚃',
      'Travelling, moving, transporting or accompanying goods or persons related to own-use production of goods': '🛺',
      'Travelling related to care-giving services for household members': '🚐',
      'Travelling time related to unpaid volunteer, trainee and other unpaid work': '🚴',
      'Travelling time related to learning': '🚎',
      'Travelling time related to culture, leisure, mass-media and sports practices': '🚖',
      'Employment-related travel': '🚅',
      'Commuting': '🚇',
      
      // Employment and work
      'Activities ancillary to employment': '👔',
      'Breaks during working time within employment': '🍵',
      'Training and studies in relation to employment': '💻',
      'Employment in corporations, government and non-profit institutions': '🏢',
      'Seeking employment': '🔍',
      'Setting up a business': '📈',
      'Other activities related to employment in household enterprises to produce goods': '🏗',
      'Other activities related to employment in household enterprises providing services': '🛎️',
      'Unpaid trainee work and related activities': '🧑‍🎓',
      'Other unpaid work activities': '📁',
      
      // Education
      'School/university attendance': '🏫',
      'Homework, being tutored, course review, research and activities related to formal education': '📝',
      'Breaks at place of formal education': '⏱️',
      'Additional study, non-formal education and courses': '📔',
      'Self-study for distance education course work (video, audio, online)': '💻',
      'Extra-curricular activities': '🎾',
      'Other activities related to formal education': '🎓',
      'Other activities related to learning': '🧠',
      
      // Social and communication
      'Talking, conversing, chatting': '💬',
      'Other activities related to socializing and communication': '🗣️',
      'Reading and writing mail (including email)': '📧',
      'Socializing/getting together/gathering activities': '🥂',
      
      // Management and planning
      'Other activities related to household management': '📑',
      'Budgeting, planning, organizing duties and activities in the household': '📅',
      'Paying household bills': '💸',
      
      // Pet care
      'Using veterinary care or other pet care services (grooming, stabling, holiday or day care)': '🐾',
      'Daily pet care': '🦮',
      'Other activities related to pet care': '🐈',
      
      // Fallback for unknown activities
      'Unknown': '❓'
    };
    return activityEmojiMap[activityCode] || '❓';
  }
  
  export { getActivityCategory, getActivityEmoji };