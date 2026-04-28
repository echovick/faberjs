import { defineComponent, watch, h } from 'vue';

export const BridgeHead = defineComponent({
  name: 'BridgeHead',

  props: {
    title: {
      type: String,
      default: undefined,
    },
  },

  setup(props, { slots }) {
    watch(
      () => props.title,
      (title) => {
        if (title !== undefined) document.title = title;
      },
      { immediate: true },
    );

    return () => (slots.default ? h('div', { style: 'display:none' }, slots.default()) : null);
  },
});
