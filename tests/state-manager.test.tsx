import { expect, test } from 'vitest';
import { StateManager } from '../src';
import { Logger } from '../src/utils/logger';
import { RenderEngine } from '../src/render-engine';
import { ActionDispatcher } from '../src';



test('State Manager Init', () => {
    let stateManager = new StateManager(
        /* id */ 'test-state-manager',
        /* logger */ new Logger('test-logger'),
        /* componentStateMap */ {},
        /* componentOutputMap */ {},
        /* remoteFSMMap */ {},
        /* renderer */ null,
        /* options */ {}
    );
    // Simple test to check if the stateManager can be initialized
    // and have a local reference to the StateManager init API
    expect(stateManager).toBeInstanceOf(StateManager);
    expect(stateManager.id).toBe('test-state-manager');
    expect(stateManager.logger).toBeInstanceOf(Logger);
    expect(stateManager.logger.id).toBe('test-logger');
    expect(stateManager.componentStateMap).toEqual({});
    expect(stateManager.componentOutputMap).toEqual({});
    expect(stateManager.remoteFSMMap).toEqual({});
    expect(stateManager.renderer).toBeInstanceOf(RenderEngine);
    expect(stateManager.actionDispatcher).toBeInstanceOf(ActionDispatcher);

    /* We should be able to short init the StateManager without passing all parameters */
    stateManager = new StateManager('test-state-manager-2');
    expect(stateManager).toBeInstanceOf(StateManager);
    expect(stateManager.id).toBe('test-state-manager-2');
    expect(stateManager.logger).toBeInstanceOf(Logger);
    expect(stateManager.componentStateMap).toEqual({});
    expect(stateManager.componentOutputMap).toEqual({});
    expect(stateManager.remoteFSMMap).toEqual({});
    expect(stateManager.renderer).toBeInstanceOf(RenderEngine);
    expect(stateManager.actionDispatcher).toBeInstanceOf(ActionDispatcher);
});