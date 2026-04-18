export function str(val: unknown): string {
  if (val == null) return '–';
  return String(val);
}

export function getSmartGreeting(displayName: string | null): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const firstName = displayName?.split(/\s+/)[0] || null;
  const name = firstName ? `, ${firstName}` : '';

  const isMonday = day === 1;
  const isFriday = day === 5;
  const isWeekend = day === 0 || day === 6;

  if (hour >= 5 && hour < 8) {
    const options = [
      { title: `Early start${name}!`, subtitle: 'You\'re ahead of the game. What can I look up for you?' },
      { title: `Good morning${name}!`, subtitle: 'Up before the sun? Let\'s make the most of it.' },
    ];
    return options[firstName ? firstName.length % options.length : 0];
  }
  if (hour >= 8 && hour < 12) {
    if (isMonday) {
      return { title: `Happy Monday${name}!`, subtitle: 'New week, fresh start. What\'s on your radar?' };
    }
    if (isFriday) {
      return { title: `Happy Friday${name}!`, subtitle: 'Almost there! Let\'s wrap up the week strong.' };
    }
    const options = [
      { title: `Good morning${name}!`, subtitle: 'What would you like to explore today?' },
      { title: `Morning${name}!`, subtitle: 'Ready to dive in. What can I help with?' },
      { title: `Hey${name}, good morning!`, subtitle: 'What\'s on your mind today?' },
    ];
    return options[hour % options.length];
  }
  if (hour >= 12 && hour < 14) {
    const options = [
      { title: `Good afternoon${name}!`, subtitle: 'Lunchtime productivity? I\'m here for it.' },
      { title: `Hey${name}!`, subtitle: 'Afternoon check-in — what do you need?' },
    ];
    return options[firstName ? firstName.length % options.length : 0];
  }
  if (hour >= 14 && hour < 17) {
    if (isFriday) {
      return { title: `Almost weekend${name}!`, subtitle: 'Last push before Friday wraps up. How can I help?' };
    }
    const options = [
      { title: `Good afternoon${name}!`, subtitle: 'Let\'s keep the momentum going. What do you need?' },
      { title: `Afternoon${name}!`, subtitle: 'Halfway through the day — what can I look into?' },
    ];
    return options[hour % options.length];
  }
  if (hour >= 17 && hour < 20) {
    const options = [
      { title: `Still going${name}?`, subtitle: 'Working late — let me help you wrap up faster.' },
      { title: `Good evening${name}!`, subtitle: 'Burning the evening oil? Let\'s make it count.' },
    ];
    return options[firstName ? firstName.length % options.length : 0];
  }
  if (hour >= 20 && hour < 23) {
    const options = [
      { title: `Night owl mode${name}!`, subtitle: 'The office is quiet, but I\'m still here. What do you need?' },
      { title: `Burning the midnight oil${name}?`, subtitle: 'I don\'t sleep either. How can I help?' },
    ];
    return options[firstName ? firstName.length % options.length : 0];
  }
  if (isWeekend) {
    return { title: `Weekend warrior${name}!`, subtitle: 'Working through the weekend? I respect the hustle.' };
  }
  return { title: `Up late${name}?`, subtitle: 'No judgment — I\'m always on. What do you need?' };
}
