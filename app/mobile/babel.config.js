module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@components': './components',
            '@screens': './screens',
            '@services': './services',
            '@contexts': './contexts',
            '@hooks': './hooks',
            '@utils': './utils',
            '@types': './types',
          },
        },
      ],
    ],
  };
};
