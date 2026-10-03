/**
 * Shared SQL fragments. Item names/icons/types are denormalized on `items` at order
 * time; when the sub type still exists its current values take precedence.
 * Fragments on venue tables carry `:venue`: they are meant for `VenueDb` queries.
 */

export const ITEM_CATEGORY_JOINS = `
    LEFT JOIN sub_types ON sub_types.venue_id = :venue AND sub_types.id = items.sub_type_id
    LEFT JOIN types ON types.venue_id = :venue AND sub_types.type_id = types.id`

export const ITEM_TYPE = 'IFNULL(types.name, items.type)'
export const ITEM_SUB_TYPE = 'IFNULL(sub_types.name, items.sub_type)'
export const ITEM_ICON = 'IFNULL(sub_types.icon, items.icon)'

/** JSON array (never NULL) of the items of a table, to be used as a correlated subquery. */
export function tableItemsJson(tableIdExpr: string): string {
    return `IFNULL((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', items.id,
            'master_item_id', items.master_item_id,
            'event_id', items.event_id,
            'table_id', items.table_id,
            'order_id', items.order_id,
            'note', items.note,
            'name', items.name,
            'type', ${ITEM_TYPE},
            'icon', ${ITEM_ICON},
            'sub_type', ${ITEM_SUB_TYPE},
            'price', items.price,
            'destination_id', items.destination_id,
            'done', items.done,
            'paid', items.paid,
            'setMinimum', items.setMinimum
        ))
        FROM items
        ${ITEM_CATEGORY_JOINS}
        WHERE items.venue_id = :venue AND items.table_id = ${tableIdExpr}
    ), JSON_ARRAY())`
}

/** `{id, username}` JSON object of a user, to be used as a correlated subquery. */
export function userJson(userIdExpr: string): string {
    return `(SELECT JSON_OBJECT('id', users.id, 'username', users.username) FROM users WHERE users.id = ${userIdExpr})`
}

export const USER_ROLES_JSON = `(
    SELECT JSON_ARRAYAGG(roles.name)
    FROM roles
    INNER JOIN user_role ON roles.id = user_role.role_id
    WHERE user_role.user_id = users.id
)`
