export class HabitTracker {
    constructor() {
        this.setupHabitCheckboxes();
    }

    setupHabitCheckboxes() {
        document.addEventListener('click', (e) => {
            const checkbox = e.target.closest('.habit-checkbox');
            if (!checkbox) return;

            e.preventDefault();

            const states = ['empty', 'checked', 'crossed', 'circled'];
            const currentState = checkbox.dataset.state || 'empty';
            const currentIndex = states.indexOf(currentState);
            const nextIndex = (currentIndex + 1) % states.length;
            const nextState = states[nextIndex];

            checkbox.dataset.state = nextState;

            console.log('Habit state changed:', nextState);
        });
    }
}