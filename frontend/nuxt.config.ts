import path from 'path';
import os from 'os';
import { NuxtConfig } from '@nuxt/types';
import fs from 'fs-extra';
import pkg from './package.json';

function getOperatingSystem() {
    const platform = os.platform();
    switch (platform) {
        case 'darwin':
            return 'mac';
        case 'win32':
            return 'windows';
        case 'linux':
            return 'linux';
        default:
            return 'web';
    }
}

const TITLE = 'acreom — The way developers get things done';
const DESCRIPTION =
    'acreom: a dev-first Markdown knowledge base with tasks running on local .md files';
const URL =
    (process.env.FE_BASE_URL as string) ||
    (process.env.DEPLOY_PRIME_URL as string) ||
    'http://localhost:3000';
const IMAGE_TWITTER = `${URL}/social/twitter.png`;
const IMAGE_FB = `${URL}/social/fb.png`;
const ENV = process.env.NODE_ENV as string;
const VERSION = pkg.version;
const ACR_PLATFORM =
    (process.env.ACR_PLATFORM as string) || 'desktop';
const ACR_OS = (process.env.ACR_OS as string) || getOperatingSystem();
const BASE_URL = (process.env.BASE_URL as string) || 'http://localhost:3000';
const TRACKING_URL = (process.env.TRACKING_URL as string) || '';
const TRACKING_URL_V2 = (process.env.TRACKING_URL_V2 as string) || '';
const MONTHLY_BILLING_URL = (process.env.MONTHLY_BILLING_URL as string) || '';
const YEARLY_BILLING_URL = (process.env.YEARLY_BILLING_URL as string) || '';
const SENTRY_AUTH_TOKEN = (process.env.SENTRY_AUTH_TOKEN as string) || '';
const GITHUB_PROXY_URL = BASE_URL + '/proxy/github';
const IS_CI = process.env.CI === 'true';
const SENTRY_DSN_URL = (process.env.SENTRY_DSN_URL as string) || '';

console.table({
    NODE_ENV: ENV,
    VERSION,
    OS: ACR_OS,
    PLATFORM: ACR_PLATFORM,
    FE_BASE_URL: URL,
    BASE_URL,
    MONTHLY_BILLING_URL,
    YEARLY_BILLING_URL,
    SENTRY_AUTH_TOKEN: SENTRY_AUTH_TOKEN
        ? SENTRY_AUTH_TOKEN.replace(/./g, '*')
        : null,
    SENTRY_DSN_URL,
    GITHUB_PROXY_URL,
    IS_CI,
});

const appleIcons = [180, 152, 144, 120, 114, 76, 72, 60, 57];

if (ACR_OS === 'web') {
    const manifest = {
        name: 'acreom',
        short_name: 'acreom',
        icons: [
            {
                src: `${URL}/android-chrome-192x192.png`,
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: `${URL}/android-chrome-512x512.png`,
                sizes: '512x512',
                type: 'image/png',
            },
        ],
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
    };

    fs.writeFileSync(
        path.join(__dirname, 'static/site.webmanifest'),
        JSON.stringify(manifest, null, '\t'),
        'utf8',
    );

    fs.copySync(
        path.join(__dirname, 'static/favicons', ENV),
        path.join(__dirname, 'static'),
    );
}

if (ENV === 'production' && IS_CI && ACR_PLATFORM === 'desktop') {
    fs.removeSync(path.join(__dirname, 'static/favicons'));
    fs.removeSync(path.join(__dirname, 'static/social'));
    fs.removeSync(path.join(__dirname, 'static/backdrop'));
    fs.removeSync(path.join(__dirname, 'static/integrations'));
    fs.removeSync(path.join(__dirname, 'static/js'));
}

const plugins = [
    '@/plugins/app-storage',
    '@/plugins/components-repository/index',
    '@/plugins/dropdown',
    '@/plugins/notification',
    '@/plugins/pane',
    '@/plugins/context-menu',
    '@/plugins/vue-tippy',
    '@/plugins/vue-final-modal',
    '@/plugins/shortcuts-manager/index',
    '@/plugins/tabs/index',
    '@/plugins/access-control/index',
    '@/plugins/pro',
    '@/plugins/virtual-collection',
    { src: '@/plugins/entities/index', ssr: false, mode: 'client' },
    { src: '@/plugins/utils/index', ssr: false, mode: 'client' },
    { src: '@/plugins/tracking/index', mode: 'client' },
    { src: '@/plugins/service-registry/index', mode: 'client' },
    '@/plugins/storage-service/index',
    '@/plugins/commands/index',
    '@/plugins/encryption/index',
    { src: '@/plugins/workers/index', mode: 'client' },
    { src: '@/plugins/vuex-persist', mode: 'client' },
    { src: '@/plugins/shortcuts', mode: 'client' },
];

const buildModules = ['nuxt-webpack-optimisations', '@nuxt/typescript-build'];

if (ACR_PLATFORM === 'mobile') {
    buildModules.push('@nuxtjs/vuetify');
}

// @ts-ignore
const config: NuxtConfig = {
    telemetry: false,
    loadingIndicator: {
        name: `~/constants/loading/loading-${ACR_PLATFORM}-${ACR_OS}.html`,
    },
    ssr: false,
    target: 'static',
    head: {
        htmlAttrs: {
            lang: 'en',
        },
        title: TITLE,
        meta: [
            { charset: 'utf-8' },
            { name: 'title', content: TITLE },
            {
                name: 'viewport',
                content:
                    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
            },

            ...(ACR_PLATFORM === 'web'
                ? [
                      {
                          hid: 'description',
                          name: 'description',
                          content: DESCRIPTION,
                      },
                      { name: 'msapplication-TileColor', content: '#000000' },
                      { name: 'theme-color', content: '#000000' },

                      // Facebook
                      { property: 'og:type', content: 'website' },
                      { property: 'og:url', content: URL },
                      { property: 'og:title', content: TITLE },
                      { property: 'og:description', content: DESCRIPTION },
                      { property: 'og:image', content: IMAGE_FB },

                      // Twitter
                      {
                          property: 'twitter:card',
                          content: 'summary_large_image',
                      },
                      { property: 'twitter:url', content: URL },
                      { property: 'twitter:title', content: TITLE },
                      { property: 'twitter:description', content: DESCRIPTION },
                      { property: 'og:image', content: IMAGE_TWITTER },
                  ]
                : []),
        ],
        link: [
            ...(ACR_PLATFORM === 'web'
                ? [
                      ...appleIcons.map(size => ({
                          rel: 'apple-touch-icon',
                          sizes: `${size}x${size}`,
                          href: `${URL}/apple-touch-icon-${size}x${size}.png`,
                      })),
                      {
                          rel: 'icon shortcut',
                          sizes: 'any',
                          href: `${URL}/favicon.ico`,
                      },
                  ]
                : []),
            {
                rel: 'prefetch',
                href: `${URL}/components/system/ACheck/check.svg`,
                as: 'image',
                type: 'image/svg+xml',
            },
        ],
    },
    css: [
        '@/assets/css/reset.css',
        './assets/scss/themes/dark-theme.scss',
        './assets/scss/themes/light-theme.scss',
        './assets/scss/global.scss',
        './assets/scss/v-calendar.scss',
        'overlayscrollbars/overlayscrollbars.css',
    ],
    pageTransition: {
        mode: '',
    },
    // @ts-ignore
    plugins,
    buildModules,
    vuetify: {
        customVariables: ['~/assets/scss/vuetify.scss'],
        defaultAssets: false,
    },
    modules: [
        '@nuxtjs/sentry',
        'nuxt-client-init-module',
        '@nuxtjs/style-resources',
        '@nuxtjs/axios',
    ],
    sentry: {
        initialize: ENV === 'production' && !!SENTRY_DSN_URL && !!SENTRY_AUTH_TOKEN,
        dsn: SENTRY_DSN_URL,
        publishRelease:
            ENV === 'production' && !!SENTRY_DSN_URL && !!SENTRY_AUTH_TOKEN
                ? {
                    authToken: SENTRY_AUTH_TOKEN,
                    org: 'acreom',
                    project: 'nuxt',
                } : false,
        sourceMapStyle: 'hidden-source-map',
        config: {
            release: VERSION,
            environment: ENV === 'production' ? 'production' : 'development',
        },
        // @ts-ignore
        initialScope: {
            app: {
                app_version: VERSION,
            },
        },
    },
    router: {
        mode: ACR_PLATFORM === 'desktop' ? 'hash' : 'history',
        linkPrefetchedClass: 'nuxt-link-prefetched',
    },
    toast: {
        position: 'bottom-right',
        duration: 2000,
    },
    watchers: {
        webpack: {
            ignored: ['android/', 'capacitor.config.ts', 'ios/'],
        },
        chokidar: {
            ignored: ['android/', 'capacitor.config.ts', 'ios/'],
        },
    },
    webpackOptimisations: {
        esbuildLoaderOptions: {
            client: {
                minifyIdentifiers: false,
                target: 'es2018',
            },
        },
        debug: true,
    },
    ignore: ['**/*.test.*', '**/*.spec.*', 'tests'],
    build: {
        transpile: ['vue-final-modal'],
        extend(config, { isClient }) {
            // @ts-ignore
            config.resolve.alias.vue = 'vue/dist/vue.esm';

            config.watchOptions = {
                ignored: ['android/', 'capacitor.config.ts', 'ios/'],
            };

            config.node = {
                fs: 'empty',
            };
            if (ENV === 'production') {
                config.devtool = 'hidden-source-map';
                const vueLoader: any = config.module?.rules.find(
                    (loader: any) => {
                        return loader.loader?.includes('vue-loader');
                    },
                );

                const TEST_ATTRIBUTE_NAME = 'data-e2e';

                vueLoader.options.compilerOptions = {};
                vueLoader.options.compilerOptions.modules = [
                    {
                        preTransformNode(astEl: any) {
                            const { attrsMap, attrsList } = astEl;
                            if (!attrsMap[TEST_ATTRIBUTE_NAME]) return astEl;
                            delete attrsMap[TEST_ATTRIBUTE_NAME];

                            const index = attrsList.findIndex(
                                (x: any) => x.name === TEST_ATTRIBUTE_NAME,
                            );

                            attrsList.splice(index, 1);

                            return astEl;
                        },
                    },
                ];
            }
            if (isClient && config.module?.rules) {
                if (Array.isArray(config.module?.noParse)) {
                    config.module?.noParse.push(/\.wasm$/);
                }
                if (!config.module?.noParse) {
                    config.module!.noParse = [/\.wasm$/];
                }
                config.module?.rules.push(
                    {
                        test: /\.wasm$/,
                        use: { loader: 'base64-loader' },
                        type: 'javascript/auto',
                    },
                    {
                        options: {
                            worker: {
                                type: 'Worker',
                                options: {
                                    type: 'module',
                                },
                            },
                        },
                        test: /\.worker\.ts$|\.worker\.min\.js$/,
                        loader: 'worker-loader',
                        exclude: /(node_modules)/,
                    },
                    {
                        test: /\.[mc]?js$/,
                        include: [
                            path.resolve(__dirname, 'node_modules/openai'),
                            path.resolve(__dirname, 'node_modules/langchain'),
                            path.resolve(__dirname, 'node_modules/js-tiktoken'),
                            path.resolve(__dirname, 'node_modules/yjs'),
                            path.resolve(__dirname, 'node_modules/lib0'),
                        ],
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: ['@babel/preset-env'],
                                plugins: [
                                    '@babel/plugin-proposal-nullish-coalescing-operator',
                                ],
                            },
                        },
                    },
                    {
                        test: /\.js$/,
                        include: [
                            path.resolve(
                                __dirname,
                                'node_modules/chrono-node/dist/',
                            ),
                            path.resolve(__dirname, 'node_modules/langchain'),
                            path.resolve(__dirname, 'node_modules/js-tiktoken'),
                            path.resolve(__dirname, 'node_modules/mermaid'),
                            path.resolve(
                                __dirname,
                                'node_modules/zeed-dom/dist/',
                            ),
                        ],
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: ['@babel/preset-env'],
                                plugins: [
                                    '@babel/plugin-proposal-nullish-coalescing-operator',
                                ],
                            },
                        },
                    },
                    {
                        test: /\.js$/,
                        include: [
                            path.resolve(__dirname, 'node_modules/@octokit'),
                        ],
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: ['@babel/preset-env'],
                                plugins: [
                                    '@babel/plugin-transform-class-static-block',
                                ],
                            },
                        },
                    },
                );
            }

            return config;
        },
        babel: {
            plugins: [
                ['@babel/plugin-proposal-private-methods', { loose: true }],
                '@babel/plugin-proposal-nullish-coalescing-operator',
            ],
        },
    },
    styleResources: {
        scss: [
            './assets/scss/colors.scss',
            './assets/scss/fonts.scss',
            './assets/scss/mixins.scss',
        ],
    },
    publicRuntimeConfig: {
        compatibility: {
            minimal: '1.14.0',
        },
        os: ACR_OS, // web, desktop, mobile
        platform: ACR_PLATFORM, // windows, macos, linux, web, android, ios
        version: VERSION,
        baseUrl: BASE_URL,
        githubProxyUrl: GITHUB_PROXY_URL,
        feBaseUrl: URL,
        env: ENV,
        axios: {
            browserBaseURL: BASE_URL,
            baseUrl: BASE_URL,
        },
        trackingUrl: TRACKING_URL,
        trackingUrlV2: TRACKING_URL_V2,
        billingURL: {
            monthly: MONTHLY_BILLING_URL,
            yearly: YEARLY_BILLING_URL,
        },
    },
    env: {
        platform: ACR_PLATFORM,
        os: ACR_OS,
        version: VERSION,
    },
    loading: false,
};

export default config;
