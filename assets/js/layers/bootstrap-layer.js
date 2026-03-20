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

  // Esperar a que la SDK de Supabase esté disponible antes de inicializar
  const waitForSB = (attempts = 0) => {
    if(typeof supabase !== 'undefined'){
      features?.initEJ?.();
      infra.initSB?.();
    } else if(attempts < 20){
      setTimeout(() => waitForSB(attempts + 1), 200);
    } else {
      console.error('Supabase SDK no cargó después de 4 segundos');
    }
  };
  setTimeout(() => waitForSB(), 100);
});

