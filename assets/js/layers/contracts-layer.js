(function initLayerRegistry(global){
  if(global.GApp && global.GApp.registerLayer && global.GApp.getLayer){
    return;
  }

  const layers = {};

  global.GApp = {
    registerLayer(name, api){
      layers[name] = Object.freeze({...api});
      return layers[name];
    },
    getLayer(name){
      return layers[name] || null;
    },
    hasLayer(name){
      return !!layers[name];
    },
    listLayers(){
      return Object.keys(layers);
    },
  };
})(window);

