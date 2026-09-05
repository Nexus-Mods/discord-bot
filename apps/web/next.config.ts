import type { NextConfig } from 'next';

const config: NextConfig = {
    // Fail the build on a type error rather than shipping one. Next's default already
    // does this; stated because the opposite is a common escape hatch and turning it on
    // should be a decision rather than a default nobody looked at.
    typescript: { ignoreBuildErrors: false },
};

export default config;
