module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(() => isTest);
  const presets = [['babel-preset-expo', { jsxImportSource: isTest ? undefined : 'nativewind' }]];

  if (!isTest) {
    presets.push('nativewind/babel');
  }

  return {
    presets,
    plugins: ['react-native-reanimated/plugin'],
  };
};
