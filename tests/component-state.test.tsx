import { test, expect } from 'vitest';
import { ComponentState } from '../src/component-state';
import { StateManager } from '../src';



test('ComponentState Init', () => {
    let stateManager = new StateManager('test-component-state')
    const componentState = new ComponentState(
        /* componentData */ { id: 'test-component' },
        stateManager.stubEvaluator
    );

    // Simple test to check if the ComponentState can be initialized
    expect(componentState).toBeInstanceOf(ComponentState); 
});