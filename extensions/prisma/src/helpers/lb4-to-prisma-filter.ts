import {AnyObject, Fields, Filter, Where} from '@loopback/repository';
import {cloneDeep} from 'lodash';
import {
  Condition,
  Filter as PrismaFilter,
  WhereFilter as PrismaWhereFilter,
} from '../';
import {AndClause, OrClause} from '../types';

/**
 * Converts a LoopBack 4 {@link @loopback/repository#Filter} to its Prisma
 * equivilant.
 *
 * @remarks
 * ## Filter Mapping
 *
 * | LoopBack 4   | Prisma  | Remarks
 * | ------------ | ------- | ----------------------------------------- |
 * | fields       | select  |                                           |
 * | include      | include |                                           |
 * | offset, skip | skip    | `skip` is ignored if `offset` is present. |
 * | limit        | take    |                                           |
 * | order        | orderBy |                                           |
 * | where        | where   |                                           |
 *
 * @see {@link lb4ToPrismaWhereFilter} for a more-detailed documentation on the
 * {@link @loopback/repository#Where} filter conversion.
 *
 * @typeParam MT key-value map of properties that will be converted, typically
 * a subclass of {@link @loopback/repository#Model}.
 * @param lb4Filter Target LoopBack 4 filter to convert.
 * @params options Filter processing configuration options.
 * @returns Type-compatible Prisma filter
 */
export function lb4ToPrismaFilter<MT extends object = AnyObject>(
  lb4Filter: Filter<MT>,
  options: {
    skipDeepClone: boolean;
  } = {skipDeepClone: false},
): PrismaFilter<MT> {
  if (!options?.skipDeepClone) lb4Filter = cloneDeep(lb4Filter);
  let prismaFilter: PrismaFilter = {};

  if (lb4Filter.fields && lb4Filter.include)
    throw new Error(
      '`fields` and `include` cannot be used simultaneously in Prisma filters.',
    );

  // Fields filter mapping
  if (lb4Filter.fields) {
    // Required to dictate that the Prisma filter without "include" is being
    // created.
    prismaFilter = {select: undefined};
    prismaFilter.select = {};

    if (Array.isArray(lb4Filter.fields)) {
      for (const field of lb4Filter.fields) {
        prismaFilter.select[field] = true;
      }
    } else {
      for (const field of Object.keys(lb4Filter.fields) as Array<
        keyof Fields<MT>
      >) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        prismaFilter.select[field] = lb4Filter.fields[field]!;
      }
    }
  }

  // Inclusion filter mapping
  if (lb4Filter.include) {
    // Required to dictate that the Prisma filter without "select" is being
    // created.
    prismaFilter = {include: undefined};
    prismaFilter.include = {};

    for (const inclusion of lb4Filter.include) {
      if (typeof inclusion === 'string') prismaFilter.include[inclusion] = true;
      else
        prismaFilter.include[inclusion.relation] = inclusion.scope
          ? lb4ToPrismaFilter(inclusion.scope, {
              ...options,
              skipDeepClone: true,
            })
          : true;
    }
  }

  // Skip/offset and limit filter mapping
  if (lb4Filter.offset) prismaFilter.skip = lb4Filter.offset;
  else if (lb4Filter.skip) prismaFilter.skip = lb4Filter.skip;
  if (lb4Filter.limit) prismaFilter.take = lb4Filter.limit;

  // Order filter mapping
  if (lb4Filter.order) {
    prismaFilter.orderBy = {};
    for (const order in lb4Filter.order) {
      const [prop, rawDirection] = order.split(' ');

      const direction = rawDirection.toLowerCase() ?? 'asc';

      if (!['asc', 'desc'].includes(direction))
        throw new Error('Invalid direciton');

      prismaFilter.orderBy[prop] = direction as 'asc' | 'desc';
    }
  }

  if (lb4Filter.where) {
    prismaFilter.where = lb4ToPrismaWhereFilter(lb4Filter.where, {
      ...options,
      skipDeepClone: true,
    });
  }

  return prismaFilter as PrismaFilter<MT>;
}

/**
 * Converts a LoopBack 4 {@link @loopback/repository#Where} filter to its Prisma
 * equivilant.
 *
 * @remarks
 * ## Where Filter Mapping
 *
 * | LoopBack 4          | Prisma       | Remarks                 |
 * | ------------------- | ------------ | ----------------------  |
 * | literal, eq         | literal      |                         |
 * | neq                 | not          |                         |
 * | gt                  | gt           |                         |
 * | gte                 | gte          |                         |
 * | lt                  | lt           |                         |
 * | lte                 | lte          |                         |
 * | between (exclusive) | lt + gt      |                         |
 * | inq                 | in           |                         |
 * | nin                 | NOT(in)      |                         |
 * | near                | N/A          |                         |
 * | like                | N/A          |                         |
 * | ilike               | N/A          |                         |
 * | regexp              | N/A          |                         |
 * | match               | search       | Non-standard LB4 filter |
 *
 * @internalRemarks
 * There's a lot of hacky type casting going on due to incompatible types.
 * While there is test coverage, we'll need to look into fixing this.
 *
 * @typeParam MT key-value map of properties that will be converted, typically
 * a subclass of {@link @loopback/repository#Model}.
 * @param lb4Filter Target LoopBack 4 where filter to convert.
 * @params options Filter processing configuration options.
 * @returns Type-compatible Prisma where filter.
 */
export function lb4ToPrismaWhereFilter<MT extends object = AnyObject>(
  lb4Filter: Where<MT>,
  options: {
    skipDeepClone: boolean;
  } = {skipDeepClone: false},
): PrismaWhereFilter<MT> {
  if (!options.skipDeepClone) lb4Filter = cloneDeep(lb4Filter);
  const prismaFilter: PrismaWhereFilter = {};

  if ('and' in lb4Filter)
    (prismaFilter as AndClause).AND = lb4Filter.and.map(filter =>
      lb4ToPrismaWhereFilter(filter, {...options, skipDeepClone: true}),
    );
  else if ('or' in lb4Filter)
    (prismaFilter as OrClause).OR = lb4Filter.or.map(filter =>
      lb4ToPrismaWhereFilter(filter, {...options, skipDeepClone: true}),
    );
  else {
    const prop = Object.keys(lb4Filter)[0] as unknown as keyof typeof lb4Filter;
    const query = lb4Filter[prop];

    if (typeof query === 'string') (prismaFilter as Condition)[prop] = query;
    else if ('eq' in query)
      (prismaFilter as Condition)[prop] = {equals: query.eq};
    else if ('neq' in query)
      (prismaFilter as Condition)[prop] = {not: query.neq};
    else if ('gt' in query)
      (prismaFilter as Condition)[prop] = {gt: query.gt as number | undefined};
    else if ('gte' in query)
      (prismaFilter as Condition)[prop] = {
        gte: query.gte as number | undefined,
      };
    else if ('lt' in query)
      (prismaFilter as Condition)[prop] = {lt: query.lt as number | undefined};
    else if ('lte' in query)
      (prismaFilter as Condition)[prop] = {
        lte: query.lte as number | undefined,
      };
    else if ('between' in query) throw Error('Not implemented');
    else if ('inq' in query)
      (prismaFilter as Condition)[prop] = {in: query.inq};
    else if ('nin' in query) throw Error('Not implemented');
    else if ('match' in query) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      prismaFilter[prop] = {match: query.match};
    } else throw new Error(`Unspported LoopBack 4 filter ('${query})`);
  }
  // // see: https://stackoverflow.com/q/52856496
  // for (const prop of (Object.keys(lb4Filter) as Array<keyof Condition<MT>>)) {
  //   prismaFilter[prop] = {};
  //   const query = lb4Filter[prop];

  //   if (typeof query === 'object') {
  //     const queryValue = Object.values(query)[0];
  //     switch(Object.keys(query)[0]) {
  //       case 'eq':
  //         prismaFilter[prop] = queryValue;
  //         break;
  //       case 'neq':
  //         prismaFilter[prop] = { not: Object.values(queryValue)[0] }
  //     }
  //   }
  // }

  // for (const [filterKey, filterValue] of Object.entries(lb4Filter)) {
  //   if (filterKey === 'and') {
  //     lb4Filter = lb4Filter as AndClause<MT>;
  //     prismaFilter.AND = [];
  //     for (const andItem in lb4Filter.and)
  //       prismaFilter.AND.push(
  //         lb4ToPrismaWhereFilter(lb4Filter.and[andItem]),
  //       );
  //   } else if (filterKey === 'or') {
  //     prismaFilter.OR = [];
  //     for (const orItem of Object.values(lb4Filter[filterKey]))
  //       prismaFilter.OR.push(
  //         lb4ToPrismaWhereFilter(orItem)
  //       )
  //   } else {
  //     // @ts-ignore
  //     switch(lb4Filter[filterKey]) {
  //       case 'literal':
  //         prismaFilter[filterKey] = filterValue;
  //         break;
  //       case 'eq':
  //         prismaFilter[filterKey] = filterValue[0];
  //         break;
  //       case 'neq':
  //         prismaFilter.not.
  //     }
  //   }
  // }

  return prismaFilter as PrismaWhereFilter<MT>;
}
