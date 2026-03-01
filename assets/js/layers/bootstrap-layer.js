window.addEventListener('load', () => {
  const required = ['core', 'features', 'infra'];
  const missing = required.filter(name => !window.GApp?.hasLayer?.(name));
  if(missing.length){
    console.error('Capas faltantes:', missing.join(', '));
    return;
  }

  const infra = window.GApp?.getLayer('infra');
  const features = window.GApp?.getLayer('features');
  if(!infra){
    console.error('Infra layer no disponible');
    return;
  }

  setTimeout(() => {
    features?.initEJ?.();
    infra.initSB?.();
  }, 500);
});

