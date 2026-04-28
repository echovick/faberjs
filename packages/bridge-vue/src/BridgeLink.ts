import { defineComponent, h } from 'vue';
import { visit } from './router';

export const BridgeLink = defineComponent({
  name: 'BridgeLink',

  props: {
    href: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      default: 'get',
    },
    preserveScroll: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['click'],

  setup(props, { slots, emit }) {
    function handleClick(event: MouseEvent): void {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      emit('click', event);
      void visit(props.href, props.method.toUpperCase()).then(() => {
        if (!props.preserveScroll) window.scrollTo(0, 0);
      });
    }

    return () => h('a', { href: props.href, onClick: handleClick }, slots.default?.());
  },
});
