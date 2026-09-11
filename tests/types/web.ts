import { createWebPet, ActionRegistry, AnimationPlan, Project } from '../../engine';
const pet = createWebPet(document.createElement('canvas'), { size: 96 });
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
