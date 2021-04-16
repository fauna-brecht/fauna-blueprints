
import faunadb, { Documents, Select } from 'faunadb'

const q = faunadb.query
const {
  Range,
  Lambda,
  Match,
  Index,
  ToMicros,
  Paginate,
  Var,
  Let,
  Collection,
  Filter,
  Equals,
  IsNonEmpty
} = q

export function CreateDeleteEventsTsAfter (collectionName, afterTime, pageSize) {
  // You can't specify both afterTime and beforeTime simultaneously.
  return Paginate(
    Documents(Collection(collectionName)),
    { events: true, after: afterTime, size: pageSize }
  )
}

export function CreateDeleteEventsTsBefore (collectionName, beforeTime, pageSize) {
  // You can't specify both afterTime and beforeTime simultaneously.
  return Paginate(
    Documents(Collection(collectionName)),
    { events: true, after: beforeTime, size: pageSize }
  )
}

// The name of an index in string format and a Fauna 'Time'.
export function UpdateEventsAfterTs (indexName, time, pageSize, afterOrBefore) {
  let paginateParameters = { events: true, after: time, size: 10 }
  if (afterOrBefore === 'before') {
    paginateParameters = { events: true, before: time, size: 10 }
  }
  const rangeLowerBoundary = afterOrBefore === 'after' ? ToMicros(time) : null
  const rangeUpperBoundary = afterOrBefore === 'before' ? ToMicros(time) : null

  return Let(
    {
      // We can use the index to determine which document references were changed since this timestamp.
      documentsCreatedOrUpdated: Paginate(
        Range(
          Match(Index(indexName)),
          rangeLowerBoundary,
          rangeUpperBoundary
        ),
        { size: pageSize }
      ),
      // Since we want the details events information, we'll get the events that occured for each document that
      // has changed or was created after the given timestamp.
      eventsDocumentsCreatedOrUpdated: q.Map(
        Var('documentsCreatedOrUpdated'),
        Lambda((ts, ref) => Paginate(
          ref,
          paginateParameters
        ))
      ),
      // Filter out created since you already have created events in 'eventsCreatedOrDeleted'. Therefore you are only interested in updated.
      eventsDocumentsUpdated: q.Filter(
        q.Map(
          Var('eventsDocumentsCreatedOrUpdated'),
          Lambda((eventsForDocs) => Filter(
            eventsForDocs,
            Lambda(event => Equals(Select(['action'], event), 'update'))
          ))
        ),
        Lambda(eventsPage => IsNonEmpty(eventsPage))
      )
    },
    Var('eventsDocumentsUpdated')
  )
}
