import { defineComponent, h, type PropType } from 'vue'
import type { IconSet, IconProps } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { DECO_ICONS } from '@/icons/deco'

/**
 * Icon set that replaces the mdi names drawn in the Art Déco set (icons/deco.ts) and falls
 * back to the mdi font for the others (brands, icons stored in old categories). Every
 * `mdi-*` in the app and in the database goes through here, Vuetify's own aliases included.
 */
const DecoIcon = defineComponent({
    name: 'DecoIcon',
    props: {
        icon: { type: [String, Function, Object, Array] as PropType<IconProps['icon']> },
        tag: { type: String, required: true },
    },
    setup(props) {
        return () => {
            const name = typeof props.icon === 'string' ? props.icon : ''
            const svg = DECO_ICONS[name]
            if (!svg) {
                return h(mdi.component, { icon: props.icon, tag: props.tag })
            }
            return h(props.tag, [
                h('svg', {
                    class: 'v-icon__svg deco-icon',
                    xmlns: 'http://www.w3.org/2000/svg',
                    viewBox: '0 0 24 24',
                    role: 'img',
                    'aria-hidden': 'true',
                    innerHTML: svg,
                }),
            ])
        }
    },
})

export const decoIconSet: IconSet = { component: DecoIcon as IconSet['component'] }
export { aliases }
