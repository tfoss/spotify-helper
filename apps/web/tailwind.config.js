/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	// LayerChart uses these classes internally but lives in node_modules (not scanned
	// by Tailwind).  Without these, the chart SVG viewport clips axis labels
	// (overflow-visible) and Spline paths default to black fill (fill-none).
	safelist: ['overflow-visible', 'fill-none'],
	darkMode: 'media',
	theme: {
		extend: {
			screens: {
				'xs': '375px',
			},
		},
	},
	plugins: [],
};
