import { Broadcast } from '../../../models/src'
import { notify } from '../socket'
import { VenueContext } from '../venue/context'

class BroadcastService {
    async broadcastMessage(ctx: VenueContext, broadcast: Broadcast): Promise<void> {
        notify.broadcast(ctx.venueId, broadcast)
    }
}

export default new BroadcastService()
