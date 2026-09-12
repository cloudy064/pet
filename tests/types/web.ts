import { createWebPet, ActionRegistry, AnimationPlan, Project } from '../../engine';
import { PetCompanion, createWebStore, growthHeight } from '../../engine/companion';
const pet = createWebPet(document.createElement('canvas'), { size: 96, assetPack: '/pipi-assets' });
pet.ready.then(async () => {
  const task = pet.play('wave', { sustain: true });
  task.release();
  await task;
  await pet.moveTo({ x: 200, y: 300 }, { mode: 'flight' });
  const project: Project = pet.exportProject();
  await pet.importProject(project);
  pet.actions.register({ id: 'pair', type: 'sequence', steps: [{ action: 'wink' }, { action: 'jump' }] });
  pet.registerType('custom', {
    validate(action) {
      if (!action.id) throw Error('id');
    },
    create() {
      return new AnimationPlan();
    },
  });
  pet.destroy();
});
new ActionRegistry([{ id: 'blink', type: 'clip', asset: 'base:blink' }]);
// @ts-expect-error invalid heading
pet.play('walk', { direction: 'north' });
// @ts-expect-error invalid movement mode
pet.moveTo({ x: 2, y: 3 }, { mode: 'teleport' });
const companion = new PetCompanion(pet, { storage: createWebStore(localStorage), careZoom: 2 });
companion.setMode('learning');
companion.handleEvent({ id: 'task-1', type: 'taskCompleted', revision: 1, confirmedGrowthPoints: 1 });
companion.feed({ operationId: 'meal-1' });
growthHeight(10, { minHeight: 58 });
// @ts-expect-error unsupported scene
companion.setMode('combat');

// @ts-expect-error learning events need a persistent replay-protection sequence
companion.handleEvent({ id: 'missing-revision', type: 'taskCompleted' });
const clickedPart: 'head' | 'belly' | 'feet' | 'wings' | null = pet.hitTestPart({ x: 100, y: 100 });
